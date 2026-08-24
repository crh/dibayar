import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvoiceDetailClient from "./invoice-detail-client";

// getByRole's accessible-name matching preserves the money formatter's real
// NBSP separator (U+00A0) as-is, unlike getByText which collapses it to a
// plain space — so accessible-name queries need the actual NBSP character.
const NBSP = String.fromCharCode(0x00a0);

const draftInvoice = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "PPH23" as const,
  status: "DRAFT" as const,
  dueDate: new Date("2026-07-31T00:00:00.000Z"),
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T00:00:00.000Z"),
};

type JsonResult = { status: number; body: unknown };

function jsonResponse({ status, body }: JsonResult) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function makeFetchMock(
  options: {
    shareGet?: JsonResult;
    sharePost?: JsonResult | JsonResult[];
    shareDelete?: JsonResult;
    statusPatch?: JsonResult;
    contactGet?: JsonResult;
  } = {},
) {
  const shareGet = options.shareGet ?? { status: 200, body: { active: false } };
  const shareDelete = options.shareDelete ?? { status: 200, body: { active: false } };
  const statusPatch = options.statusPatch ?? { status: 200, body: {} };
  const contactGet = options.contactGet ?? { status: 200, body: {} };
  const sharePostQueue = Array.isArray(options.sharePost)
    ? [...options.sharePost]
    : [options.sharePost ?? {
        status: 200,
        body: { active: true, path: "/i/deterministic-token", expiresAt: "2026-10-17T00:00:00.000Z" },
      }];

  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/contact") && method === "GET") return jsonResponse(contactGet);
    if (url.endsWith("/share") && method === "GET") return jsonResponse(shareGet);
    if (url.endsWith("/share") && method === "POST") {
      const next = sharePostQueue.length > 1 ? sharePostQueue.shift()! : sharePostQueue[0];
      return jsonResponse(next);
    }
    if (url.endsWith("/share") && method === "DELETE") return jsonResponse(shareDelete);
    return jsonResponse(statusPatch);
  });
}

// This suite exercises Dibayar's Indonesian-language behavior in depth, so it
// seeds an explicit "id" preference by default; the Indonesian default and
// explicit English behavior are covered by the focused tests below.
beforeEach(() => {
  window.localStorage.setItem("dibayar-language", "id");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("InvoiceDetailClient", () => {
  it("defaults to Indonesian when no language preference is stored", async () => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

    expect(await screen.findByRole("button", { name: "Buat tautan berbagi" })).toBeDefined();
    expect(screen.getByText("Draf")).toBeDefined();
  });

  it("keeps money formatting identical when English is selected (chrome-only translation)", async () => {
    window.localStorage.setItem("dibayar-language", "en");
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await screen.findByRole("button", { name: "Create sharing link" });

    expect(screen.getByRole("heading", { name: `Rp${NBSP}1.500.000` })).toBeDefined();
    expect(screen.queryByText(/IDR/)).toBeNull();
    expect(screen.queryByText(/1,500,000/)).toBeNull();
  });

  it("renders invoice detail and only the legal next action for a draft", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    expect(screen.getByRole("heading", { name: `Rp${NBSP}1.500.000` })).toBeDefined();
    expect(screen.getAllByText("INV/2026/07/001")).toHaveLength(2);
    expect(screen.getByText("PPh 23 (2%)")).toBeDefined();
    expect(screen.getByRole("button", { name: "Tandai sudah dikirim" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Unduh PDF" }).getAttribute("href")).toBe("/api/invoices/invoice-1/pdf");
    expect(screen.queryByRole("button", { name: "Tandai lunas" })).toBeNull();
    expect(screen.getByText("Draf")).toBeDefined();
    expect(screen.queryByText("Draft")).toBeNull();
    expect(screen.queryByText("DRAFT")).toBeNull();
  });

  it("shows the English Draft status chip on the detail page when English is selected", async () => {
    window.localStorage.setItem("dibayar-language", "en");
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await screen.findByRole("button", { name: "Create sharing link" });

    expect(screen.getByText("Draft")).toBeDefined();
    expect(screen.queryByText("Draf")).toBeNull();
  });

  it("shows the localized English loading label while a status action is saving", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("dibayar-language", "en");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: {} });
        if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
        return new Promise(() => {});
      }),
    );

    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await user.click(await screen.findByRole("button", { name: "Mark as sent" }));

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /menyimpan/i })).toBeNull();
  });

  it("keeps invoice details, sharing states, confirmations, and errors fully English", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("dibayar-language", "en");
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        shareGet: { status: 200, body: { active: true, expiresAt: "2026-10-17T00:00:00.000Z" } },
        sharePost: { status: 500, body: { error: "Tautan berbagi belum bisa dibuat. Coba lagi." } },
      }),
    );

    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, withholdingTaxType: "NONE" }} />);

    expect(await screen.findByText("Sharing link is active.")).toBeDefined();
    expect(screen.getByText("Withholding tax")).toBeDefined();
    expect(screen.getByText("Invoice amount")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Regenerate link" }));
    expect(screen.getByText("The old link will stop working immediately. Continue and create a new link?")).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Yes, create a new link" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "The sharing link could not be created. Try again.",
    );
    for (const leakedCopy of ["Pajak potong", "Tidak ada", "Nilai invoice", "Batal", "Tautan lama"]) {
      expect(document.body.textContent).not.toContain(leakedCopy);
    }
  });

  it("localizes the inactive share state in English", async () => {
    window.localStorage.setItem("dibayar-language", "en");
    vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: false } } }));

    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

    expect(await screen.findByText("No sharing link exists for this invoice yet.")).toBeDefined();
    expect(screen.queryByText(/belum ada tautan berbagi/i)).toBeNull();
  });

  it("renders Indonesian invoice copy when Indonesian is the stored language", async () => {
    window.localStorage.setItem("dibayar-language", "id");
    vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: false } } }));

    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

    expect(await screen.findByText("Pajak potong")).toBeDefined();
    expect(screen.getByText("Nilai invoice")).toBeDefined();
    expect(screen.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeDefined();
    expect(screen.queryByText("Withholding tax")).toBeNull();
    expect(screen.queryByText("No sharing link exists for this invoice yet.")).toBeNull();
  });

  it("offers only the undo action (T-19) for a paid invoice, no forward transitions", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "PAID" }} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    expect(screen.getByRole("heading", { name: "Status pembayaran" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Batalkan status lunas" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Tandai sudah dikirim" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tandai lunas" })).toBeNull();
  });

  it("shows a truthful paid-proof block for a PAID invoice, but keeps the due-date field editable in Details (T-20: no header date editor)", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(
      <InvoiceDetailClient
        initialInvoice={{ ...draftInvoice, status: "PAID", updatedAt: new Date("2026-07-20T00:00:00.000Z") }}
      />,
    );
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    expect(screen.getByRole("button", { name: "Batalkan status lunas" })).toBeDefined();
    expect(screen.getByText("Invoice ini sudah ditandai lunas.")).toBeDefined();
    expect(screen.getByText("Rp 1.500.000 diterima")).toBeDefined();
    // The due-date field lives in Details now, not the hero header, and stays
    // available there regardless of payment status.
    expect(screen.getByLabelText("Tanggal jatuh tempo")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Simpan tanggal" })).toBeNull();
  });

  it("puts the payment-status section before the invoice-details section (T-19 reorder)", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "SENT" }} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    const paymentStatusHeading = screen.getByRole("heading", { name: "Status pembayaran" });
    const detailsHeading = screen.getByRole("heading", { name: "Rincian invoice" });
    expect(paymentStatusHeading.compareDocumentPosition(detailsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("puts the primary WhatsApp action as the first interactive element below the amount (F9)", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } } }));
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    // Excludes the page-level "back to dashboard" nav link, which sits above
    // the amount and isn't part of the invoice content F9 governs.
    const buttonsAndLinks = screen
      .getAllByRole("button")
      .concat(screen.getAllByRole("link"))
      .filter((el) => el.textContent !== "← Kembali ke dashboard");
    const firstInteractive = buttonsAndLinks.sort(
      (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1),
    )[0];
    expect(firstInteractive.textContent).toBe("Kirim lewat WhatsApp");
  });

  it("undoing a paid invoice (T-19) sends the PAID→SENT transition and shows the SENT actions afterward", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        statusPatch: { status: 200, body: { invoice: { ...draftInvoice, status: "SENT" } } },
      }),
    );
    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "PAID" }} />);

    await user.click(await screen.findByRole("button", { name: "Batalkan status lunas" }));

    // Back to SENT's own actions, not DRAFT's "mark as sent" (that action
    // moves DRAFT to SENT; it isn't SENT's own next step).
    expect(await screen.findByRole("button", { name: "Tandai jatuh tempo" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Tandai lunas" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Batalkan status lunas" })).toBeNull();
    // Undoing is not a "just marked paid" moment -- no celebration banner.
    expect(screen.queryByRole("status")).toBeNull();
  });

  describe("Status yang ditampilkan (derived, bukan status mentah)", () => {
    it("shows the derived SENT chip, not the stale raw OVERDUE, when the invoice has no due date", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(
        <InvoiceDetailClient
          initialInvoice={{ ...draftInvoice, status: "OVERDUE", dueDate: null }}
          now={new Date("2026-07-24T00:00:00.000Z")}
        />,
      );
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(screen.getByText("Terkirim")).toBeDefined();
      expect(screen.queryByText("Terlambat")).toBeNull();
      // Raw state-machine actions for OVERDUE stay unchanged regardless of display status.
      expect(screen.getByRole("button", { name: "Tandai lunas" })).toBeDefined();
      // Not actually overdue by date, so the primary action stays the plain share label.
      expect(screen.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeDefined();
    });

    it("derives OVERDUE at 00:01 Jakarta the day after the due date, and switches the primary action to Kirim pengingat", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(
        <InvoiceDetailClient
          initialInvoice={{ ...draftInvoice, status: "SENT", dueDate: new Date("2026-07-19T00:00:00.000Z") }}
          now={new Date("2026-07-19T17:01:00.000Z")}
        />,
      );
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(screen.getByText("Terlambat")).toBeDefined();
      expect(screen.queryByText("Terkirim")).toBeNull();
      expect(screen.getByRole("button", { name: "Kirim pengingat" })).toBeDefined();
      expect(screen.queryByRole("button", { name: "Kirim lewat WhatsApp" })).toBeNull();
    });
  });

  describe("Aksi utama WhatsApp (header)", () => {
    it("creates a share link first, then opens the send-template message, when not overdue", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
      await user.click(whatsappButton);

      await waitFor(() => expect(open).toHaveBeenCalled());
      const href = open.mock.calls[0]?.[0] as string;
      expect(href).toContain(encodeURIComponent("INV/2026/07/001"));
      const message = decodeURIComponent(href.split("?text=")[1] ?? "");
      expect(message).toContain("Kopi Nusantara");
      expect(message).toContain("Jatuh tempo 31 Jul 2026.");
      expect(await screen.findByTitle(`${window.location.origin}/i/deterministic-token`)).toBeDefined();
    });

    it("opens WhatsApp directly, without creating a new link, when a link is already active", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      const fetchMock = makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      expect(await screen.findByTitle(`${window.location.origin}/i/deterministic-token`)).toBeDefined();

      const postCallsBefore = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST").length;
      await user.click(screen.getByRole("button", { name: "Kirim lewat WhatsApp" }));

      await waitFor(() => expect(open).toHaveBeenCalled());
      const postCallsAfter = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST").length;
      expect(postCallsAfter).toBe(postCallsBefore);
    });

    it("sends the chase-template message (not the send template) once overdue, mentioning the due date", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(
        <InvoiceDetailClient
          initialInvoice={{ ...draftInvoice, status: "OVERDUE", dueDate: new Date("2026-07-01T00:00:00.000Z") }}
          now={new Date("2026-07-24T00:00:00.000Z")}
        />,
      );
      await user.click(await screen.findByRole("button", { name: "Kirim pengingat" }));

      await waitFor(() => expect(open).toHaveBeenCalled());
      const href = open.mock.calls[0]?.[0] as string;
      const message = decodeURIComponent(href.split("?text=")[1] ?? "");
      expect(message).toContain("izin mengingatkan");
      expect(message).toContain("jatuh tempo 1 Jul 2026");
    });

    it("uses a custom chase template from Settings instead of the default when overdue", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(
        <InvoiceDetailClient
          initialInvoice={{ ...draftInvoice, status: "OVERDUE", dueDate: new Date("2026-07-01T00:00:00.000Z") }}
          now={new Date("2026-07-24T00:00:00.000Z")}
          templateChase="Tolong segera lunasi {nomor_invoice}, {brand}. Link: {tautan}"
        />,
      );
      await user.click(await screen.findByRole("button", { name: "Kirim pengingat" }));

      await waitFor(() => expect(open).toHaveBeenCalled());
      const message = decodeURIComponent((open.mock.calls[0]?.[0] as string).split("?text=")[1] ?? "");
      expect(message).toBe("Tolong segera lunasi INV/2026/07/001, Kopi Nusantara. Link: https://dibayar.example/i/deterministic-token".replace("https://dibayar.example", window.location.origin));
    });

    it("drops the due-date line entirely when the invoice has no due date, even using the default send template", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));

      await waitFor(() => expect(open).toHaveBeenCalled());
      const message = decodeURIComponent((open.mock.calls[0]?.[0] as string).split("?text=")[1] ?? "");
      expect(message).not.toContain("Jatuh tempo");
      expect(message).not.toContain("Jatuh tempo .");
    });

    it("sends an Indonesian-only WhatsApp message even when the creator's UI language is English", async () => {
      window.localStorage.setItem("dibayar-language", "en");
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "+62 812-3456-7890" } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Send on WhatsApp" });
      await user.click(whatsappButton);

      await waitFor(() => expect(open).toHaveBeenCalled());
      const href = open.mock.calls[0]?.[0] as string;
      const message = decodeURIComponent(href.split("?text=")[1] ?? "");
      expect(message).not.toMatch(/reminder|overdue|thank you|due date/i);
    });

    it("disables the primary WhatsApp button and shows a repair block naming the deal, when the deal contact is unusable", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "not-a-phone", brand: "Kopi Nusantara" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });

      await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", true));
      expect(screen.getByText(/nomor whatsapp untuk kopi nusantara sepertinya tidak valid/i)).toBeDefined();
      expect(screen.getByLabelText("Perbaiki nomor WhatsApp")).toHaveProperty("value", "not-a-phone");
    });

    it("writes a fixed contact number back to the deal, unblocking the primary button afterward", async () => {
      const user = userEvent.setup();
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          calls.push({ url, init });
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: { contactWa: "not-a-phone", brand: "Kopi Nusantara" } });
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
          if (url.includes("/api/deals/") && method === "PATCH") {
            return jsonResponse({ status: 200, body: { deal: { id: "deal-1", contactWa: "6281234567890" } } });
          }
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const repairInput = await screen.findByLabelText("Perbaiki nomor WhatsApp");
      fireEvent.change(repairInput, { target: { value: "0812-3456-7890" } });
      await user.click(screen.getByRole("button", { name: "Simpan nomor" }));

      expect(await screen.findByText("Nomor WhatsApp disimpan")).toBeDefined();
      const patchCall = calls.find((call) => call.url.includes("/api/deals/") && call.init?.method === "PATCH");
      expect(patchCall?.url).toBe("/api/deals/deal-1");
      expect(JSON.parse(patchCall!.init!.body as string)).toEqual({ contactWa: "0812-3456-7890" });
      await waitFor(() => expect(screen.getByRole("button", { name: "Kirim lewat WhatsApp" })).toHaveProperty("disabled", false));
    });

    it("keeps the primary WhatsApp button available when the invoice has no due date, since a plain share never fabricates one", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
      }));

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });

      await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));
    });

    it("shows a stale-link disabled reason after a reload, without reconstructing the plaintext link", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: true, expiresAt: "2026-10-17T00:00:00.000Z" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });

      await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", true));
      expect(screen.getByText(/tautan yang bisa dipakai tidak tersedia setelah halaman dimuat ulang/i)).toBeDefined();
    });
  });

  describe("Kontak WhatsApp dengan retry", () => {
    it("shows a retry affordance in the payment-status section when the contact fetch fails, and recovers after retry", async () => {
      const user = userEvent.setup();
      let contactCallCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) {
            contactCallCount += 1;
            if (contactCallCount === 1) return jsonResponse({ status: 500, body: { error: "boom" } });
            return jsonResponse({ status: 200, body: { contactWa: "0812-3456-7890" } });
          }
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: true } });
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText("Kontak belum bisa dimuat. Coba lagi.")).toBeDefined();
      await user.click(screen.getByRole("button", { name: "Coba lagi" }));

      await waitFor(() => expect(contactCallCount).toBe(2));
      expect(screen.queryByText("Kontak belum bisa dimuat. Coba lagi.")).toBeNull();
    });

    it("does not update state after unmount when the contact fetch resolves late (no act() warning)", async () => {
      let resolveContact: ((value: unknown) => void) | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) {
            return new Promise((resolve) => {
              resolveContact = resolve;
            });
          }
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      const { unmount } = render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      unmount();

      await act(async () => {
        resolveContact?.(jsonResponse({ status: 200, body: { contactWa: "0812-3456-7890" } }));
      });
    });
  });

  describe("Bagikan invoice", () => {
    it("shows a loading indicator before the share state is known", () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => new Promise(() => {})),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(screen.getByText(/memuat status berbagi/i)).toBeDefined();
    });

    it("offers to create the first link when no share exists yet", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: false } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText(/belum ada tautan berbagi/i)).toBeDefined();
      expect(screen.queryByRole("button", { name: /buat ulang tautan/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /cabut tautan/i })).toBeNull();
    });

    it("creates a link, shows the full absolute URL, and offers a copy control with success feedback", async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: false } },
          sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));

      const expectedLink = `${window.location.origin}/i/deterministic-token`;
      expect(await screen.findByTitle(expectedLink)).toBeDefined();

      const copyButton = screen.getByRole("button", { name: /salin tautan/i });
      await user.click(copyButton);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedLink);
      expect(await screen.findByText("Tersalin")).toBeDefined();
      expect(copyButton.getAttribute("aria-label")).toBe("Salin tautan invoice");
    });

    it("shows a controlled Bahasa alert when the clipboard write is denied or unavailable", async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: false } },
          sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));

      const expectedLink = `${window.location.origin}/i/deterministic-token`;
      expect(await screen.findByTitle(expectedLink)).toBeDefined();

      await user.click(screen.getByRole("button", { name: /salin tautan/i }));
      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        "Gagal menyalin. Tekan lama untuk salin manual.",
      );
      const manualCopyInput = (await screen.findByTestId("share-link-manual-copy")) as HTMLInputElement;
      expect(manualCopyInput.value).toBe(expectedLink);
    });

    it("restores a cached share path in the same browser session so Copy works after reload", async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
      const fetchMock = makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      });
      vi.stubGlobal("fetch", fetchMock);

      const { unmount } = render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      const expectedLink = `${window.location.origin}/i/deterministic-token`;
      expect(await screen.findByTitle(expectedLink)).toBeDefined();
      unmount();

      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: true } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      expect(await screen.findByTitle(expectedLink)).toBeDefined();

      await user.click(screen.getByRole("button", { name: /salin tautan/i }));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedLink);
    });

    it("clears the cached share path when the server reports the share inactive", async () => {
      window.sessionStorage.setItem("dibayar-share-path:invoice-1", "/i/deterministic-token");
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: false } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText(/belum ada tautan berbagi/i)).toBeDefined();
      expect(window.sessionStorage.getItem("dibayar-share-path:invoice-1")).toBeNull();
    });

    it("clears the cached share path once the owner revokes the link", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", makeFetchMock({
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
        shareDelete: { status: 200, body: { active: false } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      expect(await screen.findByTitle(`${window.location.origin}/i/deterministic-token`)).toBeDefined();
      expect(window.sessionStorage.getItem("dibayar-share-path:invoice-1")).toBe("/i/deterministic-token");

      await user.click(screen.getByRole("button", { name: /cabut tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, cabut tautan" }));

      expect(await screen.findByText(/belum ada tautan berbagi/i)).toBeDefined();
      expect(window.sessionStorage.getItem("dibayar-share-path:invoice-1")).toBeNull();
    });

    it("shows the reset expiry after regenerating", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", makeFetchMock({
        shareGet: { status: 200, body: { active: true, expiresAt: "2026-10-17T00:00:00.000Z" } },
        sharePost: {
          status: 200,
          body: { active: true, path: "/i/new-token", expiresAt: "2026-11-01T00:00:00.000Z" },
        },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: /buat ulang tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, buat tautan baru" }));

      expect(await screen.findByText("Tautan aktif sampai 1 Nov 2026.")).toBeDefined();
    });

    it("requires explicit confirmation with destructive wording before revoking, then returns to inactive", async () => {
      const user = userEvent.setup();
      const fetchMock = makeFetchMock({
        shareGet: { status: 200, body: { active: true } },
        shareDelete: { status: 200, body: { active: false } },
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: /cabut tautan/i }));

      expect(screen.getByText(/penerima tidak akan bisa membuka invoice ini lagi/i)).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/share"), expect.objectContaining({ method: "DELETE" }));

      await user.click(screen.getByRole("button", { name: "Ya, cabut tautan" }));

      expect(await screen.findByText(/belum ada tautan berbagi/i)).toBeDefined();
    });

    it("shows a controlled Bahasa error when the share state cannot be loaded, with a retry", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 500, body: { error: "boom" } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText("Status berbagi belum bisa dimuat. Coba lagi.")).toBeDefined();
      expect(screen.getByRole("button", { name: "Coba lagi" })).toBeDefined();
    });

    it("keeps every share control at a touch target of at least 44px", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: false } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const createButton = await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(createButton.className).toMatch(/h-11|min-h-\[44px\]/);
    });
  });

  describe("Tanggal jatuh tempo di bagian Rincian (T-20)", () => {
    it("lets the owner set the due date from Details and sends the correct PATCH payload", async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          calls.push({ url, init });
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: {} });
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
          if (method === "PATCH") {
            const body = JSON.parse(init!.body as string);
            return jsonResponse({ status: 200, body: { invoice: { ...draftInvoice, dueDate: body.dueDate } } });
          }
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      const input = screen.getByLabelText("Tanggal jatuh tempo");
      await act(async () => {
        fireEvent.change(input, { target: { value: "2026-08-15" } });
      });

      await screen.findByText("15 Agu 2026");
      const patchCall = calls.find((call) => call.init?.method === "PATCH");
      expect(patchCall?.url).toBe("/api/invoices/invoice-1");
      expect(JSON.parse(patchCall!.init!.body as string)).toEqual({ dueDate: "2026-08-15" });
    });

    it("lets the owner clear an existing due date via Kosongkan, sending an explicit null payload", async () => {
      const user = userEvent.setup();
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          calls.push({ url, init });
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: {} });
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
          if (method === "PATCH") {
            const body = JSON.parse(init!.body as string);
            return jsonResponse({ status: 200, body: { invoice: { ...draftInvoice, dueDate: body.dueDate } } });
          }
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: new Date("2026-07-31T00:00:00.000Z") }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      await user.click(screen.getByRole("button", { name: "Kosongkan" }));

      await waitFor(() => expect(screen.getAllByText(/Belum ditentukan/).length).toBeGreaterThan(0));
      const patchCall = calls.find((call) => call.init?.method === "PATCH");
      expect(JSON.parse(patchCall!.init!.body as string)).toEqual({ dueDate: null });
    });

    it("shows a controlled Bahasa error and keeps the previous date when the due date update fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: {} });
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
          if (method === "PATCH") return jsonResponse({ status: 500, body: { error: "boom" } });
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      const input = screen.getByLabelText("Tanggal jatuh tempo");
      await act(async () => {
        fireEvent.change(input, { target: { value: "2026-08-15" } });
      });

      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        "Tanggal jatuh tempo belum bisa diperbarui. Coba lagi.",
      );
    });

    it("no longer shows the browser-dependent format hint or the old Save/Clear button pair anywhere (T-20 deletion)", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(document.body.textContent).not.toMatch(/hari\/bulan\/tahun|peramban/i);
      expect(screen.queryByRole("button", { name: "Simpan tanggal" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Hapus tanggal" })).toBeNull();
    });
  });

  describe("Basis PPh pada rincian invoice", () => {
    it("names the applicable withholding rate next to a non-zero withholding type", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, withholdingTaxType: "PPH21" }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(screen.getByText("PPh 21 (5%)")).toBeDefined();
    });

    it("explains why withholding is None instead of showing a bare label", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, withholdingTaxType: "NONE" }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(screen.getByText("Tidak ada")).toBeDefined();
      expect(screen.getByText("Tidak ada potongan pajak untuk invoice ini.")).toBeDefined();
    });
  });

  describe("settings dependency notice", () => {
    it("shows the Indonesian notice inside Details when issuer/bank details are incomplete", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} hasIncompleteIssuer />);

      expect(
        await screen.findByText("Lengkapi identitas penerbit dan rekening di Pengaturan agar invoice lengkap."),
      ).toBeDefined();
    });

    it("shows the English notice when English is selected", async () => {
      window.localStorage.setItem("dibayar-language", "en");
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} hasIncompleteIssuer />);

      expect(
        await screen.findByText("Complete issuer and bank details in Settings so the invoice is complete."),
      ).toBeDefined();
    });

    it("does not render the notice when issuer/bank details are complete", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} hasIncompleteIssuer={false} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(
        screen.queryByText("Lengkapi identitas penerbit dan rekening di Pengaturan agar invoice lengkap."),
      ).toBeNull();
    });
  });
});
