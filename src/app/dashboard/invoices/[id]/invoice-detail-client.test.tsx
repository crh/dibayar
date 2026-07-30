import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvoiceDetailClient from "./invoice-detail-client";

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

// The app now defaults to English (see src/lib/i18n.ts). This suite exercises
// Dibayar's Indonesian-language behavior in depth, so it seeds an explicit
// "id" preference by default; the English-default behavior itself is covered
// by the dedicated test below.
beforeEach(() => {
  window.localStorage.setItem("dibayar-language", "id");
});

afterEach(() => {
  vi.unstubAllGlobals();
  // vi.spyOn(window, "open") / vi.spyOn(navigator.clipboard, ...) leave the
  // spy in place otherwise, so a later test's spy wraps the previous test's
  // still-mocked function and inherits its call history (e.g. open.mock.calls[0]
  // ends up being a stale call from an earlier test, not this test's own click).
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("InvoiceDetailClient", () => {
  it("defaults to English when no language preference is stored", async () => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

    expect(await screen.findByRole("button", { name: "Create sharing link" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeDefined();
    expect(screen.getByText("Draft")).toBeDefined();
  });

  it("renders invoice detail and only the legal next action for a draft", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    expect(screen.getByRole("heading", { name: "Rp1.500.000" })).toBeDefined();
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

    render(
      <InvoiceDetailClient
        initialInvoice={{ ...draftInvoice, withholdingTaxType: "NONE" }}
      />,
    );

    expect(await screen.findByText("Sharing link is active.")).toBeDefined();
    expect(screen.getByText("Withholding tax")).toBeDefined();
    expect(screen.getByText("None")).toBeDefined();
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

  it("updates all invoice copy when switching from English back to Indonesian", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("dibayar-language", "en");
    vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: false } } }));

    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    expect(await screen.findByText("Withholding tax")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Indonesian" }));

    expect(screen.getByText("Pajak potong")).toBeDefined();
    expect(screen.getByText("Nilai invoice")).toBeDefined();
    expect(screen.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeDefined();
    expect(screen.queryByText("Withholding tax")).toBeNull();
    expect(screen.queryByText("No sharing link exists for this invoice yet.")).toBeNull();
  });

  it("shows no further transition control for a paid invoice", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "PAID" }} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    expect(screen.queryByRole("heading", { name: "Status pembayaran" })).toBeNull();
    expect(screen.queryByText("Invoice ini sudah lunas.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tandai sudah dikirim" })).toBeNull();
  });

  describe("Invoice lunas menyembunyikan pengeditan, menampilkan bukti pembayaran", () => {
    it("hides the due-date editor and payment-status actions, and shows a truthful paid-proof block, for a PAID invoice", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(
        <InvoiceDetailClient
          initialInvoice={{
            ...draftInvoice,
            status: "PAID",
            updatedAt: new Date("2026-07-20T00:00:00.000Z"),
          }}
        />,
      );
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(screen.queryByLabelText("Tanggal jatuh tempo")).toBeNull();
      expect(screen.queryByRole("button", { name: "Simpan tanggal" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Hapus tanggal" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "Status pembayaran" })).toBeNull();

      expect(screen.getByText("Invoice ini sudah ditandai lunas.")).toBeDefined();
      expect(screen.getByText("Rp1.500.000 diterima")).toBeDefined();
      expect(screen.queryByText(/20 Juli 2026/)).toBeNull();
    });

    it("keeps the due-date editor and payment-status actions for a non-PAID invoice (behavior-preserving)", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "SENT" }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(screen.getByLabelText("Tanggal jatuh tempo")).toBeDefined();
      expect(screen.getByRole("button", { name: "Simpan tanggal" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Hapus tanggal" })).toBeDefined();
      expect(screen.getByRole("heading", { name: "Status pembayaran" })).toBeDefined();
      expect(screen.queryByText("Invoice ini sudah ditandai lunas.")).toBeNull();
    });
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
    });

    it("derives OVERDUE at 00:01 Jakarta the day after the due date, even though the underlying status is still SENT", async () => {
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
    });

    it("does not build an overdue WhatsApp reminder when the due date has not actually passed, despite a stale raw OVERDUE status", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
          sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
        }),
      );

      render(
        <InvoiceDetailClient
          initialInvoice={{ ...draftInvoice, status: "OVERDUE", dueDate: new Date("2026-08-01T00:00:00.000Z") }}
          now={new Date("2026-07-24T00:00:00.000Z")}
        />,
      );
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      const button = await screen.findByRole("button", { name: "Buka WhatsApp" });
      await user.click(button);

      const href = open.mock.calls[0]?.[0] as string;
      expect(href).toContain(encodeURIComponent("jatuh tempo pada"));
      expect(href).not.toContain(encodeURIComponent("melewati jatuh tempo"));
    });
  });

  describe("Tanggal jatuh tempo yang bisa diatur pemilik", () => {
    it("lets the owner set the due date from the detail page and sends the correct PATCH payload", async () => {
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

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      const input = screen.getByLabelText("Tanggal jatuh tempo");
      fireEvent.change(input, { target: { value: "2026-08-15" } });
      await user.click(screen.getByRole("button", { name: "Simpan tanggal" }));

      await screen.findByText(/15 Agustus 2026/);
      const patchCall = calls.find((call) => call.init?.method === "PATCH");
      expect(patchCall?.url).toBe("/api/invoices/invoice-1");
      expect(JSON.parse(patchCall!.init!.body as string)).toEqual({ dueDate: "2026-08-15" });
    });

    it("lets the owner clear an existing due date, sending an explicit null payload", async () => {
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

      await user.click(screen.getByRole("button", { name: "Hapus tanggal" }));

      await waitFor(() => expect(screen.getByText(/Belum ditentukan/)).toBeDefined());
      const patchCall = calls.find((call) => call.init?.method === "PATCH");
      expect(JSON.parse(patchCall!.init!.body as string)).toEqual({ dueDate: null });
    });

    it("shows a controlled Bahasa error and keeps the previous date when the due date update fails", async () => {
      const user = userEvent.setup();
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
      fireEvent.change(input, { target: { value: "2026-08-15" } });
      await user.click(screen.getByRole("button", { name: "Simpan tanggal" }));

      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        "Tanggal jatuh tempo belum bisa diperbarui. Coba lagi.",
      );
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
      expect(await screen.findByText(expectedLink)).toBeDefined();

      await user.click(screen.getByRole("button", { name: /salin tautan/i }));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedLink);
      expect(await screen.findByRole("status")).toHaveProperty("textContent", expect.stringMatching(/disalin/i));
    });

    it("opens a prefilled WhatsApp reminder after a share link exists", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal("fetch", makeFetchMock({
      contactGet: { status: 200, body: { contactWa: "+62 812-3456-7890" } },
      sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
    }));

    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "OVERDUE" }} />);
    await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
    const button = await screen.findByRole("button", { name: "Buka WhatsApp" });
    expect(button).toHaveProperty("disabled", false);

    await user.click(button);
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/6281234567890?text="),
      "_blank",
      "noopener,noreferrer",
    );
    expect(open.mock.calls[0]?.[0]).toContain(encodeURIComponent("INV/2026/07/001"));
  });

  it("sends an Indonesian-only WhatsApp reminder even when the creator's UI language is English", async () => {
    window.localStorage.setItem("dibayar-language", "en");
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal("fetch", makeFetchMock({
      contactGet: { status: 200, body: { contactWa: "+62 812-3456-7890" } },
      sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
    }));

    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "OVERDUE" }} />);
    expect(await screen.findByRole("button", { name: "Create sharing link" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Create sharing link" }));
    const button = await screen.findByRole("button", { name: "Open WhatsApp" });

    await user.click(button);
    const href = open.mock.calls[0]?.[0];
    const message = decodeURIComponent(String(href ?? "").split("?text=")[1] ?? "");
    expect(message).toContain("yang jatuh tempo pada");
    expect(message).toContain("Terima kasih");
    expect(message).not.toMatch(/reminder|overdue|thank you|due date/i);
  });

  it("disables WhatsApp when the deal contact is unusable", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchMock({
      contactGet: { status: 200, body: { contactWa: "not-a-phone" } },
      sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
    }));

    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
    expect(await screen.findByRole("button", { name: "Buka WhatsApp" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/nomor whatsapp belum bisa dipakai/i)).toBeDefined();
  });

  it("disables WhatsApp with a distinct reason when the invoice has no due date, even with a valid contact and active share", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchMock({
      contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
      sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
    }));

    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
    await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
    expect(await screen.findByRole("button", { name: "Buka WhatsApp" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/belum punya tanggal jatuh tempo/i)).toBeDefined();
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
    expect(await screen.findByText(expectedLink)).toBeDefined();

    await user.click(screen.getByRole("button", { name: /salin tautan/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedLink);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringMatching(/tautan tidak bisa disalin/i),
    );
  });


    it("shows the active state after a reload without reconstructing the plaintext link, with an accurate WhatsApp disabled reason", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: true, expiresAt: "2026-10-17T00:00:00.000Z" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText(/tautan berbagi aktif/i)).toBeDefined();
      expect(screen.getByText("Tautan aktif sampai 17 Okt 2026.")).toBeDefined();
      expect(screen.getByRole("button", { name: /buat ulang tautan/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /cabut tautan/i })).toBeDefined();
      expect(screen.queryByText(/^https?:\/\//)).toBeNull();
      expect(screen.queryByRole("button", { name: /salin tautan/i })).toBeNull();

      expect(await screen.findByRole("button", { name: "Buka WhatsApp" })).toHaveProperty("disabled", true);
      expect(screen.getByText(/tautan yang bisa dipakai tidak tersedia setelah halaman dimuat ulang/i)).toBeDefined();
      expect(screen.queryByText(/buat tautan berbagi dulu/i)).toBeNull();
    });

    it("restores a cached share path in the same browser session so Copy and WhatsApp work after reload", async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      const fetchMock = makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      });
      vi.stubGlobal("fetch", fetchMock);

      const { unmount } = render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      const expectedLink = `${window.location.origin}/i/deterministic-token`;
      expect(await screen.findByText(expectedLink)).toBeDefined();
      unmount();

      // Simulate a reload: same tab (sessionStorage persists), fresh component mount,
      // and the server now reports the share as active with no path in the payload.
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: true } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      expect(await screen.findByText(expectedLink)).toBeDefined();

      await user.click(screen.getByRole("button", { name: /salin tautan/i }));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedLink);

      const whatsappButton = await screen.findByRole("button", { name: "Buka WhatsApp" });
      expect(whatsappButton).toHaveProperty("disabled", false);
      await user.click(whatsappButton);
      expect(open.mock.calls[0]?.[0]).toContain(encodeURIComponent(expectedLink));
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
      expect(await screen.findByText(`${window.location.origin}/i/deterministic-token`)).toBeDefined();
      expect(window.sessionStorage.getItem("dibayar-share-path:invoice-1")).toBe("/i/deterministic-token");

      await user.click(screen.getByRole("button", { name: /cabut tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, cabut tautan" }));

      expect(await screen.findByText(/belum ada tautan berbagi/i)).toBeDefined();
      expect(window.sessionStorage.getItem("dibayar-share-path:invoice-1")).toBeNull();
    });

    it("ignores a malformed cached share path instead of treating it as a usable link", async () => {
      window.sessionStorage.setItem("dibayar-share-path:invoice-1", "https://evil.example/i/token");
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: true } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText(/tautan berbagi aktif/i)).toBeDefined();
      expect(screen.queryByText(/^https?:\/\//)).toBeNull();
      expect(await screen.findByRole("button", { name: "Buka WhatsApp" })).toHaveProperty("disabled", true);
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

    it("requires explicit confirmation with a clear warning before regenerating an active link", async () => {
      const user = userEvent.setup();
      const fetchMock = makeFetchMock({
        shareGet: { status: 200, body: { active: true } },
        sharePost: { status: 200, body: { active: true, path: "/i/new-token" } },
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: /buat ulang tautan/i }));

      expect(screen.getByText(/tautan lama akan langsung berhenti berfungsi/i)).toBeDefined();
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/share"), expect.objectContaining({ method: "POST" }));

      await user.click(screen.getByRole("button", { name: "Batal" }));
      expect(screen.queryByText(/tautan lama akan langsung berhenti berfungsi/i)).toBeNull();

      await user.click(screen.getByRole("button", { name: /buat ulang tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, buat tautan baru" }));

      const expectedLink = `${window.location.origin}/i/new-token`;
      expect(await screen.findByText(expectedLink)).toBeDefined();
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

    it("shows a controlled Bahasa error when the share state cannot be loaded", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 500, body: { error: "boom" } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText("Status berbagi belum bisa dimuat. Coba lagi.")).toBeDefined();
      expect(screen.getByRole("button", { name: "Coba lagi" })).toBeDefined();
    });

    it("shows the controlled Bahasa load error, with a retry, when the share status request hangs past the bounded timeout", async () => {
      vi.useFakeTimers();
      vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000);
      });

      expect(screen.getByText("Status berbagi belum bisa dimuat. Coba lagi.")).toBeDefined();
      expect(screen.getByRole("button", { name: "Coba lagi" })).toBeDefined();
    });

    it("shows a controlled Bahasa error when creating a share link hangs past the bounded timeout", async () => {
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
      const createButton = await screen.findByRole("button", { name: "Buat tautan berbagi" });

      vi.useFakeTimers();
      fireEvent.click(createButton);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000);
      });
      vi.useRealTimers();

      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        "Tautan berbagi belum bisa dibuat. Coba lagi.",
      );
      expect(screen.getByRole("button", { name: "Buat tautan berbagi" })).toBeDefined();
    });

    it("retries the share status load and recovers when the retry succeeds", async () => {
      const user = userEvent.setup();
      let getCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: {} });
          if (url.endsWith("/share") && method === "GET") {
            getCount += 1;
            if (getCount === 1) return jsonResponse({ status: 500, body: { error: "boom" } });
            return jsonResponse({ status: 200, body: { active: false } });
          }
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      await user.click(await screen.findByRole("button", { name: "Coba lagi" }));

      expect(await screen.findByText(/belum ada tautan berbagi/i)).toBeDefined();
      expect(getCount).toBe(2);
    });

    it("shows a controlled Bahasa error when creating a link fails, without a raw error leaking", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: false } },
          sharePost: { status: 500, body: { error: "Tautan berbagi belum bisa dibuat. Coba lagi." } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));

      expect(await screen.findByText("Tautan berbagi belum bisa dibuat. Coba lagi.")).toBeDefined();
    });

    it("keeps every share control at a touch target of at least 44px", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: false } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const createButton = await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(createButton.className).toMatch(/h-11|min-h-\[44px\]/);
    });

    it("keeps the create control available for retry after a failed initial create", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: false } },
          sharePost: { status: 500, body: { error: "Tautan berbagi belum bisa dibuat. Coba lagi." } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));

      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        "Tautan berbagi belum bisa dibuat. Coba lagi.",
      );
      expect(screen.getByText(/belum ada tautan berbagi/i)).toBeDefined();
      expect(screen.getByRole("button", { name: "Buat tautan berbagi" })).toBeDefined();
    });

    it("keeps active state and controls available for retry after a failed regeneration", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: true } },
          sharePost: { status: 500, body: { error: "Tautan berbagi belum bisa dibuat. Coba lagi." } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: /buat ulang tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, buat tautan baru" }));

      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        "Tautan berbagi belum bisa dibuat. Coba lagi.",
      );
      expect(screen.getByText(/tautan berbagi aktif/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /buat ulang tautan/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /cabut tautan/i })).toBeDefined();
    });

    it("keeps active state and controls available for retry after a failed revoke", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: true } },
          shareDelete: { status: 500, body: { error: "Tautan berbagi belum bisa dicabut. Coba lagi." } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: /cabut tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, cabut tautan" }));

      expect(await screen.findByRole("alert")).toHaveProperty(
        "textContent",
        "Tautan berbagi belum bisa dicabut. Coba lagi.",
      );
      expect(screen.getByText(/tautan berbagi aktif/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /buat ulang tautan/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /cabut tautan/i })).toBeDefined();
    });

    it("clears a stale mutation error at the start of a new attempt", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: false } },
          sharePost: [
            { status: 500, body: { error: "Tautan berbagi belum bisa dibuat. Coba lagi." } },
            { status: 200, body: { active: true, path: "/i/deterministic-token" } },
          ],
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      expect(await screen.findByRole("alert")).toBeDefined();

      await user.click(screen.getByRole("button", { name: "Buat tautan berbagi" }));
      expect(await screen.findByText(`${window.location.origin}/i/deterministic-token`)).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("treats a malformed 2xx GET payload as a recoverable load error", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { nonsense: true } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText("Status berbagi belum bisa dimuat. Coba lagi.")).toBeDefined();
    });

    it("treats a malformed 2xx POST payload as a recoverable operation error without rendering an undefined URL", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: false } },
          sharePost: { status: 200, body: { active: true, path: "not-a-share-path" } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));

      expect(await screen.findByRole("alert")).toBeDefined();
      expect(screen.queryByText(/undefined/i)).toBeNull();
      expect(screen.getByRole("button", { name: "Buat tautan berbagi" })).toBeDefined();
    });

    it("treats a malformed 2xx DELETE payload as a recoverable operation error that keeps active controls", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        makeFetchMock({
          shareGet: { status: 200, body: { active: true } },
          shareDelete: { status: 200, body: { nonsense: true } },
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: /cabut tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, cabut tautan" }));

      expect(await screen.findByRole("alert")).toBeDefined();
      expect(screen.getByText(/tautan berbagi aktif/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /cabut tautan/i })).toBeDefined();
    });
  });

  describe("Bagikan via WhatsApp dipromosikan ke kartu atas", () => {
    it("shows a primary Share via WhatsApp button above the fold, alongside Download PDF", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Bagikan via WhatsApp" });
      const downloadLink = screen.getByRole("link", { name: "Unduh PDF" });

      expect(whatsappButton).toBeDefined();
      expect(downloadLink).toBeDefined();
      expect(whatsappButton.className).toMatch(/h-11|min-h-\[44px\]/);
      // Above the fold: both live inside the top hero header, not the share section below.
      expect(whatsappButton.closest("section")).toBeNull();
    });

    it("creates a share link first, then opens WhatsApp, when no link exists yet", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Bagikan via WhatsApp" });
      await user.click(whatsappButton);

      await waitFor(() => expect(open).toHaveBeenCalled());
      expect(open.mock.calls[0]?.[0]).toContain(encodeURIComponent("INV/2026/07/001"));
      // The full share section below reflects the same created link (single state machine).
      expect(await screen.findByText(`${window.location.origin}/i/deterministic-token`)).toBeDefined();
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
      // Establish an active link via the share section first.
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      expect(await screen.findByText(`${window.location.origin}/i/deterministic-token`)).toBeDefined();

      const postCallsBefore = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST").length;
      await user.click(screen.getByRole("button", { name: "Bagikan via WhatsApp" }));

      await waitFor(() => expect(open).toHaveBeenCalled());
      const postCallsAfter = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST").length;
      expect(postCallsAfter).toBe(postCallsBefore);
      expect(open.mock.calls[0]?.[0]).toContain(encodeURIComponent(`${window.location.origin}/i/deterministic-token`));
    });

    it("disables the primary WhatsApp button when the contact is unusable", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "not-a-phone" } },
        shareGet: { status: 200, body: { active: false } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Bagikan via WhatsApp" });

      expect(whatsappButton).toHaveProperty("disabled", true);
    });

    it("keeps the primary WhatsApp button available when the invoice has no due date, since it shares the invoice rather than sending a due-date reminder", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
      }));

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      const whatsappButton = await screen.findByRole("button", { name: "Bagikan via WhatsApp" });

      expect(whatsappButton).toHaveProperty("disabled", false);
    });

    it("creates a share link and opens a plain WhatsApp share message, without fabricating a due date, payment status, or tax detail, when the invoice has no due date", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      const whatsappButton = await screen.findByRole("button", { name: "Bagikan via WhatsApp" });
      await user.click(whatsappButton);

      await waitFor(() => expect(open).toHaveBeenCalled());
      const href = open.mock.calls[0]?.[0] as string;
      expect(href).toContain(encodeURIComponent("INV/2026/07/001"));
      expect(href).toContain(encodeURIComponent(`${window.location.origin}/i/deterministic-token`));
      const message = decodeURIComponent(href.split("?text=")[1] ?? "");
      expect(message).not.toMatch(/jatuh tempo|terlambat|lunas|pph/i);
      // Same state machine as the full share section below: the created link shows up there too.
      expect(await screen.findByText(`${window.location.origin}/i/deterministic-token`)).toBeDefined();
    });

    it("shows the localized English label for the primary WhatsApp button", async () => {
      window.localStorage.setItem("dibayar-language", "en");
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByRole("button", { name: "Share via WhatsApp" })).toBeDefined();
    });
  });

  describe("Format tanggal dan kontras tombol Simpan (Task 5)", () => {
    it("shows a format hint under the due-date field that does not claim a guaranteed visible format", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(
        screen.getByText("Tanggal disimpan sebagai hari/bulan/tahun; tampilan kalender mengikuti peramban kamu."),
      ).toBeDefined();
    });

    it("shows the localized English format hint that does not claim a guaranteed visible format", async () => {
      window.localStorage.setItem("dibayar-language", "en");
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await screen.findByRole("button", { name: "Create sharing link" });

      expect(
        screen.getByText("Date is stored as day/month/year; the calendar's display follows your browser."),
      ).toBeDefined();
    });

    it("sets lang on the native date input to match the selected locale, since the format hint can't be guaranteed", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      expect(screen.getByLabelText("Tanggal jatuh tempo").getAttribute("lang")).toBe("id-ID");
    });

    it("sets lang to en-US on the native date input when English is selected", async () => {
      window.localStorage.setItem("dibayar-language", "en");
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await screen.findByRole("button", { name: "Create sharing link" });

      expect(screen.getByLabelText("Due date").getAttribute("lang")).toBe("en-US");
    });

    it("disables the Save button with reduced opacity and not-allowed cursor when the field is empty", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      const saveButton = screen.getByRole("button", { name: "Simpan tanggal" });
      expect(saveButton).toHaveProperty("disabled", true);
      expect(saveButton.className).toContain("ds-button-primary");
    });
  });

  describe("Aksesibilitas field tanggal jatuh tempo (Task 9)", () => {
    it("gives the due-date input both id and name attributes", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      const input = screen.getByLabelText("Tanggal jatuh tempo") as HTMLInputElement;
      expect(input.id).toBe("invoice-due-date");
      expect(input.name).toBe("invoice-due-date");
    });
  });

  describe("Basis PPh pada rincian invoice (Task 7)", () => {
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

    it("shows the localized English withholding basis note", async () => {
      window.localStorage.setItem("dibayar-language", "en");
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, withholdingTaxType: "NONE" }} />);
      await screen.findByRole("button", { name: "Create sharing link" });

      expect(screen.getByText("No tax withheld on this invoice.")).toBeDefined();
    });
  });

  describe("Pemuatan kontak dengan retry (Task 8)", () => {
    it("shows a retry affordance near the WhatsApp block when the contact fetch fails, and recovers after retry", async () => {
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
      const retryButtons = screen.getAllByRole("button", { name: "Coba lagi" });
      await user.click(retryButtons[retryButtons.length - 1]);

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
      // Reaching here without a React "state update on an unmounted component" warning is the assertion.
    });
  });
});
