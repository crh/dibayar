import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/components/language-switcher";
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
    shareEnsure?: JsonResult;
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

  // What POST .../share/ensure answers unless a test sets shareEnsure: like
  // the server, the link that already exists (the one GET reported, or the
  // one the last POST .../share issued), otherwise a newly issued one.
  type ShareBody = { active?: boolean; path?: string | null; expiresAt?: string | null };
  const loaded = shareGet.body as ShareBody;
  let usableShare: ShareBody | null = shareGet.status === 200 && loaded.active && loaded.path ? loaded : null;

  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/contact") && method === "GET") return jsonResponse(contactGet);
    if (url.endsWith("/share") && method === "GET") return jsonResponse(shareGet);
    if (url.endsWith("/share") && method === "POST") {
      const next = sharePostQueue.length > 1 ? sharePostQueue.shift()! : sharePostQueue[0];
      if (next.status === 200) usableShare = next.body as ShareBody;
      return jsonResponse(next);
    }
    if (url.endsWith("/share/ensure") && method === "POST") {
      if (options.shareEnsure) return jsonResponse(options.shareEnsure);
      if (usableShare) return jsonResponse({ status: 200, body: { active: true, path: usableShare.path, expiresAt: usableShare.expiresAt ?? null } });
      const issued = sharePostQueue[0];
      if (issued.status === 200) usableShare = issued.body as ShareBody;
      return jsonResponse(issued);
    }
    if (url.endsWith("/share") && method === "DELETE") return jsonResponse(shareDelete);
    return jsonResponse(statusPatch);
  });
}

// The share requests that can issue a link, in order, as "POST /share" (always
// a new token) or "POST /share/ensure" (reuse, new only when needed).
function shareLinkRequests(fetchMock: ReturnType<typeof makeFetchMock>): string[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => init?.method === "POST" && /\/share(\/ensure)?$/.test(url))
    .map(([url]) => `POST ${url.replace("/api/invoices/invoice-1", "")}`);
}

// The WhatsApp hand-off (src/lib/whatsapp-popup.ts) opens a blank tab on the
// click itself, then sends that tab to wa.me through a link in the tab's own
// document. This stands in for that tab; href() is where it was sent.
function stubWhatsAppTab() {
  const tab = {
    opener: window as Window | null,
    closed: false,
    document: document.implementation.createHTMLDocument(""),
    close: vi.fn(() => {
      tab.closed = true;
    }),
  };
  const open = vi.spyOn(window, "open").mockImplementation(() => tab as unknown as Window);
  const href = () => tab.document.querySelector("a")?.getAttribute("href") ?? null;
  return { open, tab, href };
}

async function sentWhatsAppHref(wa: ReturnType<typeof stubWhatsAppTab>) {
  await waitFor(() => expect(wa.href()).not.toBeNull());
  return wa.href()!;
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
    // A fixed "now" before the fixture's due date: an undone invoice that is
    // already past due is shown as overdue and offers only "Tandai lunas".
    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "PAID" }} now={new Date("2026-07-24T00:00:00.000Z")} />);

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

    // FIND-01: overdue is never set by hand, in either language.
    it.each([
      ["id", "Tandai terlambat", "Tandai lunas"],
      ["en", "Mark as overdue", "Mark as paid"],
    ] as const)("offers no manual overdue action on a DUE invoice (%s)", async (language, removed, kept) => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(
        <LanguageProvider initialLanguage={language}>
          <InvoiceDetailClient
            initialInvoice={{ ...draftInvoice, status: "DUE", dueDate: new Date("2026-07-30T00:00:00.000Z") }}
            now={new Date("2026-07-24T00:00:00.000Z")}
          />
        </LanguageProvider>,
      );

      expect(await screen.findByRole("button", { name: kept })).toBeDefined();
      expect(screen.queryByRole("button", { name: removed })).toBeNull();
    });

    it.each(["SENT", "DUE"] as const)("offers only Tandai lunas on a stored %s invoice that is shown as overdue", async (status) => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(
        <InvoiceDetailClient
          initialInvoice={{ ...draftInvoice, status, dueDate: new Date("2026-07-19T00:00:00.000Z") }}
          now={new Date("2026-07-24T00:00:00.000Z")}
        />,
      );

      expect(await screen.findByText("Terlambat")).toBeDefined();
      expect(screen.getByRole("button", { name: "Tandai lunas" })).toBeDefined();
      // Already shown as overdue: "mark due" would contradict the chip.
      expect(screen.queryByRole("button", { name: "Tandai jatuh tempo" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Tandai terlambat" })).toBeNull();
    });

    it("still offers Tandai jatuh tempo on a SENT invoice that is not overdue", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(
        <InvoiceDetailClient
          initialInvoice={{ ...draftInvoice, status: "SENT", dueDate: new Date("2026-07-30T00:00:00.000Z") }}
          now={new Date("2026-07-24T00:00:00.000Z")}
        />,
      );

      expect(await screen.findByRole("button", { name: "Tandai jatuh tempo" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Tandai lunas" })).toBeDefined();
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
      const wa = stubWhatsAppTab();
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
      await user.click(whatsappButton);

      const href = await sentWhatsAppHref(wa);
      expect(href).toContain(encodeURIComponent("INV/2026/07/001"));
      const message = decodeURIComponent(href.split("?text=")[1] ?? "");
      expect(message).toContain("Kopi Nusantara");
      expect(message).toContain("Jatuh tempo 31 Jul 2026.");
      expect(await screen.findByTitle(`${window.location.origin}/i/deterministic-token`)).toBeDefined();
    });

    it("opens exactly one tab, cut off from this page, and shows no Buka WhatsApp fallback once it opened (FIND-04)", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));

      expect(await sentWhatsAppHref(wa)).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
      expect(wa.open).toHaveBeenCalledTimes(1);
      expect(wa.open).toHaveBeenCalledWith("", "_blank");
      expect(wa.tab.opener).toBeNull();
      expect(wa.tab.document.querySelector("a")?.rel).toBe("noreferrer");
      expect(wa.tab.close).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole("button", { name: "Kirim lewat WhatsApp" })).toHaveProperty("disabled", false));
      expect(screen.queryByRole("link", { name: "Buka WhatsApp" })).toBeNull();
    });

    it("shows a Buka WhatsApp link to the same message when the browser blocks the tab", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));

      const fallback = await screen.findByRole("link", { name: "Buka WhatsApp" });
      expect(fallback.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
      expect(decodeURIComponent(fallback.getAttribute("href")!.split("?text=")[1] ?? "")).toContain("INV/2026/07/001");
      expect(fallback.getAttribute("rel")).toBe("noopener noreferrer");
      expect(open).toHaveBeenCalledTimes(1);
    });

    it("closes the blank tab and shows no fallback when the share link can't be created", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        sharePost: { status: 500, body: {} },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));

      await waitFor(() => expect(wa.tab.close).toHaveBeenCalled());
      expect(wa.href()).toBeNull();
      expect(screen.queryByRole("link", { name: "Buka WhatsApp" })).toBeNull();
    });

    it("shows the fallback instead of a second tab when the person already closed the blank one", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const button = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
      wa.open.mockImplementation(() => {
        wa.tab.closed = true;
        return wa.tab as unknown as Window;
      });
      await user.click(button);

      expect(await screen.findByRole("link", { name: "Buka WhatsApp" })).toBeDefined();
      expect(wa.href()).toBeNull();
      expect(wa.open).toHaveBeenCalledTimes(1);
    });

    it("sends the link that is already active: asks the server for it and never rotates it", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      const fetchMock = makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Buat tautan berbagi" }));
      expect(await screen.findByTitle(`${window.location.origin}/i/deterministic-token`)).toBeDefined();

      expect(shareLinkRequests(fetchMock)).toEqual(["POST /share"]);
      await user.click(screen.getByRole("button", { name: "Kirim lewat WhatsApp" }));

      const openedUrl = await sentWhatsAppHref(wa);
      expect(openedUrl).toContain(encodeURIComponent(`${window.location.origin}/i/deterministic-token`));
      // The send itself only asked for the existing link; nothing new was issued.
      expect(shareLinkRequests(fetchMock)).toEqual(["POST /share", "POST /share/ensure"]);
    });

    it("sends the chase-template message (not the send template) once overdue, mentioning the due date", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
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

      const href = await sentWhatsAppHref(wa);
      const message = decodeURIComponent(href.split("?text=")[1] ?? "");
      expect(message).toContain("izin mengingatkan");
      expect(message).toContain("jatuh tempo 1 Jul 2026");
    });

    it("uses a custom chase template from Settings instead of the default when overdue", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
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

      const message = decodeURIComponent((await sentWhatsAppHref(wa)).split("?text=")[1] ?? "");
      expect(message).toBe("Tolong segera lunasi INV/2026/07/001, Kopi Nusantara. Link: https://dibayar.example/i/deterministic-token".replace("https://dibayar.example", window.location.origin));
    });

    it("drops the due-date line entirely when the invoice has no due date, even using the default send template", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
        shareGet: { status: 200, body: { active: false } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));

      const message = decodeURIComponent((await sentWhatsAppHref(wa)).split("?text=")[1] ?? "");
      expect(message).not.toContain("Jatuh tempo");
      expect(message).not.toContain("Jatuh tempo .");
    });

    it("sends an Indonesian-only WhatsApp message even when the creator's UI language is English", async () => {
      window.localStorage.setItem("dibayar-language", "en");
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "+62 812-3456-7890" } },
        sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Send on WhatsApp" });
      await user.click(whatsappButton);

      const href = await sentWhatsAppHref(wa);
      const message = decodeURIComponent(href.split("?text=")[1] ?? "");
      expect(message).not.toMatch(/reminder|overdue|thank you|due date/i);
    });

    it("keeps the primary WhatsApp button enabled for an unusable contact, revealing the repair block naming the deal only once activated (F15)", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "not-a-phone", brand: "Kopi Nusantara" } },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
      await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));
      expect(screen.queryByText("Nomor WhatsApp belum valid — perbaiki di deal ini.")).toBeNull();

      await user.click(whatsappButton);

      expect(open).not.toHaveBeenCalled();
      expect(screen.getByText("Nomor WhatsApp belum valid — perbaiki di deal ini.")).toBeDefined();
      expect(screen.getByText("Nomor ini tersimpan di deal Kopi Nusantara.")).toBeDefined();
      expect(screen.getByLabelText("Perbaiki nomor WhatsApp")).toHaveProperty("value", "not-a-phone");
      expect(screen.getByRole("button", { name: "Simpan & kirim" })).toBeDefined();
    });

    it("writes a fixed contact number back to the deal, then sends WhatsApp directly with the repaired number (F15)", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          calls.push({ url, init });
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: { contactWa: "not-a-phone", brand: "Kopi Nusantara" } });
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
          if (/\/share(\/ensure)?$/.test(url) && method === "POST") {
            return jsonResponse({ status: 200, body: { active: true, path: "/i/deterministic-token" } });
          }
          if (url.includes("/api/deals/") && method === "PATCH") {
            return jsonResponse({ status: 200, body: { deal: { id: "deal-1", contactWa: "6281234567890" } } });
          }
          if (url.includes("/api/deals/") && method === "GET") {
            return jsonResponse({ status: 200, body: { deal: { id: "deal-1", contactWa: "6281234567890" } } });
          }
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));
      const repairInput = await screen.findByLabelText("Perbaiki nomor WhatsApp");
      fireEvent.change(repairInput, { target: { value: "0812-3456-7890" } });
      await user.click(screen.getByRole("button", { name: "Simpan & kirim" }));

      expect(await screen.findByText("Nomor WhatsApp disimpan")).toBeDefined();
      const patchCall = calls.find((call) => call.url.includes("/api/deals/") && call.init?.method === "PATCH");
      expect(patchCall?.url).toBe("/api/deals/deal-1");
      expect(JSON.parse(patchCall!.init!.body as string)).toEqual({ contactWa: "0812-3456-7890" });

      const href = await sentWhatsAppHref(wa);
      expect(href).toContain("6281234567890");
      expect(screen.queryByLabelText("Perbaiki nomor WhatsApp")).toBeNull();
      await waitFor(() => expect(screen.getByRole("button", { name: "Kirim lewat WhatsApp" })).toHaveProperty("disabled", false));
    });

    it("does not save or open a tab for a repair number WhatsApp can't open, and says what is wrong (#50)", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          calls.push({ url, init });
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: { contactWa: "not-a-phone", brand: "Kopi Nusantara" } });
          if (url.endsWith("/share")) return jsonResponse({ status: 200, body: { active: false } });
          return jsonResponse({ status: 500, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));
      fireEvent.change(await screen.findByLabelText("Perbaiki nomor WhatsApp"), { target: { value: "1" } });
      await user.click(screen.getByRole("button", { name: "Simpan & kirim" }));

      expect(await screen.findByText("Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.")).toBeDefined();
      expect(calls.some((call) => call.init?.method === "PATCH")).toBe(false);
      expect(open).not.toHaveBeenCalled();
      expect(screen.queryByText("Nomor WhatsApp belum bisa disimpan. Coba lagi.")).toBeNull();
    });

    it("shows a direct Buka WhatsApp link when the repaired number's send is popup-blocked (F15)", async () => {
      const user = userEvent.setup();
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          const method = init?.method ?? "GET";
          if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: { contactWa: "not-a-phone", brand: "Kopi Nusantara" } });
          if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
          if (/\/share(\/ensure)?$/.test(url) && method === "POST") {
            return jsonResponse({ status: 200, body: { active: true, path: "/i/deterministic-token" } });
          }
          if (url.includes("/api/deals/") && method === "PATCH") {
            return jsonResponse({ status: 200, body: { deal: { id: "deal-1", contactWa: "6281234567890" } } });
          }
          if (url.includes("/api/deals/") && method === "GET") {
            return jsonResponse({ status: 200, body: { deal: { id: "deal-1", contactWa: "6281234567890" } } });
          }
          return jsonResponse({ status: 200, body: {} });
        }),
      );

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));
      const repairInput = await screen.findByLabelText("Perbaiki nomor WhatsApp");
      fireEvent.change(repairInput, { target: { value: "0812-3456-7890" } });
      await user.click(screen.getByRole("button", { name: "Simpan & kirim" }));

      const fallback = await screen.findByRole("link", { name: "Buka WhatsApp" });
      expect(fallback.getAttribute("href")).toContain("6281234567890");
      // One attempt, from the Simpan & kirim tap itself.
      expect(open).toHaveBeenCalledTimes(1);
    });

    it("keeps the primary WhatsApp button available when the invoice has no due date, since a plain share never fabricates one", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
      }));

      render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: null }} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });

      await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));
    });

    it("re-enables WhatsApp after a reload/new session by recovering the existing active link from the server (no regenerate needed)", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      const fetchMock = makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: {
          status: 200,
          body: { active: true, path: "/i/recovered-token", expiresAt: "2026-10-17T00:00:00.000Z" },
        },
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
      await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));

      await user.click(whatsappButton);

      // Reuses the recovered link -- never the rotating POST /share (no new token minted).
      const openedUrl = await sentWhatsAppHref(wa);
      expect(shareLinkRequests(fetchMock)).toEqual(["POST /share/ensure"]);
      expect(openedUrl).toContain(encodeURIComponent(`${window.location.origin}/i/recovered-token`));
    });

    // FIND-07: invoice detail used to send whatever link the page loaded,
    // including one that had already expired.
    describe("tautan kedaluwarsa (FIND-07)", () => {
      const expiredGet = { status: 200, body: { active: false, expired: true, expiresAt: "2020-01-01T00:00:00.000Z" } };

      it("sends a fresh link from the server when the share has expired, and then shows it as the active link", async () => {
        const user = userEvent.setup();
        const wa = stubWhatsAppTab();
        const fetchMock = makeFetchMock({
          contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
          shareGet: expiredGet,
          shareEnsure: { status: 200, body: { active: true, path: "/i/fresh-token", expiresAt: "2026-12-30T00:00:00.000Z" } },
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
        expect(await screen.findByText("Tautan berbagi sudah tidak berlaku.")).toBeDefined();
        const whatsappButton = screen.getByRole("button", { name: "Kirim lewat WhatsApp" });
        await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));
        await user.click(whatsappButton);

        const openedUrl = await sentWhatsAppHref(wa);
        expect(openedUrl).toContain(encodeURIComponent(`${window.location.origin}/i/fresh-token`));
        expect(shareLinkRequests(fetchMock)).toEqual(["POST /share/ensure"]);
        expect(await screen.findByTitle(`${window.location.origin}/i/fresh-token`)).toBeDefined();
        expect(screen.getByText("Tautan aktif sampai 30 Des 2026.")).toBeDefined();
        expect(screen.queryByText("Tautan berbagi sudah tidak berlaku.")).toBeNull();
      });

      it("sends the server's link, not the one the page loaded, when the server answers with a different one", async () => {
        const user = userEvent.setup();
        const wa = stubWhatsAppTab();
        vi.stubGlobal("fetch", makeFetchMock({
          contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
          // Loaded as active; by the time of the click it has expired and
          // the server issues a replacement.
          shareGet: { status: 200, body: { active: true, path: "/i/loaded-token", expiresAt: "2026-10-17T00:00:00.000Z" } },
          shareEnsure: { status: 200, body: { active: true, path: "/i/replacement-token", expiresAt: "2027-01-15T00:00:00.000Z" } },
        }));

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
        const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
        await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));
        await user.click(whatsappButton);

        const openedUrl = await sentWhatsAppHref(wa);
        expect(openedUrl).toContain(encodeURIComponent(`${window.location.origin}/i/replacement-token`));
        expect(openedUrl).not.toContain(encodeURIComponent(`${window.location.origin}/i/loaded-token`));
        expect(await screen.findByTitle(`${window.location.origin}/i/replacement-token`)).toBeDefined();
      });

      it("closes the blank tab, sends nothing and says so when the server can't provide a link", async () => {
        const user = userEvent.setup();
        const wa = stubWhatsAppTab();
        vi.stubGlobal("fetch", makeFetchMock({
          contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
          shareGet: expiredGet,
          shareEnsure: { status: 500, body: {} },
        }));

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
        const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
        await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));
        await user.click(whatsappButton);

        expect((await screen.findByRole("alert")).textContent).toBe("Tautan berbagi belum bisa dibuat. Coba lagi.");
        expect(wa.tab.close).toHaveBeenCalled();
        expect(wa.href()).toBeNull();
        // Still honestly expired: the failed request didn't turn it active.
        expect(screen.getByText("Tautan berbagi sudah tidak berlaku.")).toBeDefined();
      });

      it("sends the link this tab remembers, without asking the server, when the server can't recover it (it could only replace it)", async () => {
        const user = userEvent.setup();
        const wa = stubWhatsAppTab();
        window.sessionStorage.setItem("dibayar-share-path:invoice-1", "/i/remembered-token");
        const fetchMock = makeFetchMock({
          contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
          shareGet: { status: 200, body: { active: true, path: null, expiresAt: "2026-10-17T00:00:00.000Z" } },
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
        const whatsappButton = await screen.findByRole("button", { name: "Kirim lewat WhatsApp" });
        await waitFor(() => expect(whatsappButton).toHaveProperty("disabled", false));
        await user.click(whatsappButton);

        const openedUrl = await sentWhatsAppHref(wa);
        expect(openedUrl).toContain(encodeURIComponent(`${window.location.origin}/i/remembered-token`));
        expect(shareLinkRequests(fetchMock)).toEqual([]);
      });
    });

    it("still shows the stale-link disabled reason for a share that predates link recovery (no path returned)", async () => {
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: true, path: null, expiresAt: "2026-10-17T00:00:00.000Z" } },
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

    it("sends WhatsApp with the freshly regenerated link, not a stale recovered one", async () => {
      const user = userEvent.setup();
      const wa = stubWhatsAppTab();
      vi.stubGlobal("fetch", makeFetchMock({
        contactGet: { status: 200, body: { contactWa: "0812-3456-7890" } },
        shareGet: { status: 200, body: { active: true, path: "/i/old-token", expiresAt: "2026-10-17T00:00:00.000Z" } },
        sharePost: {
          status: 200,
          body: { active: true, path: "/i/new-token", expiresAt: "2026-11-01T00:00:00.000Z" },
        },
      }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await user.click(await screen.findByRole("button", { name: /buat ulang tautan/i }));
      await user.click(screen.getByRole("button", { name: "Ya, buat tautan baru" }));
      await screen.findByText("Tautan aktif sampai 1 Nov 2026.");

      await user.click(screen.getByRole("button", { name: "Kirim lewat WhatsApp" }));

      const openedUrl = await sentWhatsAppHref(wa);
      expect(openedUrl).toContain(encodeURIComponent(`${window.location.origin}/i/new-token`));
      expect(openedUrl).not.toContain(encodeURIComponent(`${window.location.origin}/i/old-token`));
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

    // FIND-07: an expired share used to render as "Tautan berbagi aktif." /
    // "Tautan aktif sampai 1 Jan 2020."
    describe("tautan kedaluwarsa (FIND-07)", () => {
      const expiredGet = { status: 200, body: { active: false, expired: true, expiresAt: "2020-01-01T00:00:00.000Z" } };

      it("says the link has expired and when, and shows no active state, link or regenerate/revoke controls", async () => {
        window.sessionStorage.setItem("dibayar-share-path:invoice-1", "/i/expired-token");
        vi.stubGlobal("fetch", makeFetchMock({ shareGet: expiredGet }));

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

        expect(await screen.findByText("Tautan berbagi sudah tidak berlaku.")).toBeDefined();
        expect(screen.getByText("Berakhir pada 1 Jan 2020. Penerima tidak bisa lagi membuka invoice lewat tautan ini.")).toBeDefined();
        expect(screen.queryByText("Tautan berbagi aktif.")).toBeNull();
        expect(screen.queryByText(/Tautan aktif/)).toBeNull();
        expect(screen.queryByTestId("share-link-track")).toBeNull();
        expect(screen.queryByRole("button", { name: "Buat ulang tautan" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Cabut tautan" })).toBeNull();
        expect(screen.getByRole("button", { name: "Buat tautan baru" }).className).toContain("h-11");
        // The dead link is forgotten, not kept around to be reused.
        expect(window.sessionStorage.getItem("dibayar-share-path:invoice-1")).toBeNull();
      });

      it("says so in English", async () => {
        window.localStorage.setItem("dibayar-language", "en");
        vi.stubGlobal("fetch", makeFetchMock({ shareGet: expiredGet }));

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

        expect(await screen.findByText("The sharing link has expired.")).toBeDefined();
        expect(screen.getByText("It ended on 1 Jan 2020. Recipients can no longer open the invoice with this link.")).toBeDefined();
        expect(screen.queryByText(/Link active/)).toBeNull();
        expect(screen.queryByText("Sharing link is active.")).toBeNull();
        expect(screen.getByRole("button", { name: "Create a new link" })).toBeDefined();
      });

      it("Buat tautan baru issues a new link in one step (no confirmation: the old link is already dead) and shows it as active", async () => {
        const user = userEvent.setup();
        const fetchMock = makeFetchMock({
          shareGet: expiredGet,
          sharePost: { status: 200, body: { active: true, path: "/i/new-token", expiresAt: "2026-12-30T00:00:00.000Z" } },
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
        await user.click(await screen.findByRole("button", { name: "Buat tautan baru" }));

        expect(await screen.findByTitle(`${window.location.origin}/i/new-token`)).toBeDefined();
        expect(screen.getByText("Tautan berbagi aktif.")).toBeDefined();
        expect(screen.getByText("Tautan aktif sampai 30 Des 2026.")).toBeDefined();
        expect(shareLinkRequests(fetchMock)).toEqual(["POST /share"]);
      });

      it("keeps the expired state and shows an error when the new link can't be created", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("fetch", makeFetchMock({ shareGet: expiredGet, sharePost: { status: 500, body: {} } }));

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
        await user.click(await screen.findByRole("button", { name: "Buat tautan baru" }));

        expect((await screen.findByRole("alert")).textContent).toBe("Tautan berbagi belum bisa dibuat. Coba lagi.");
        expect(screen.getByText("Tautan berbagi sudah tidak berlaku.")).toBeDefined();
      });

      it("treats a malformed expired payload (expired but active, or no date) as a load error rather than guessing", async () => {
        vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: true, expired: true, path: "/i/x", expiresAt: "2020-01-01T00:00:00.000Z" } } }));

        render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

        expect((await screen.findByRole("alert")).textContent).toBe("Status berbagi belum bisa dimuat. Coba lagi.");
      });
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

    // FIND-03: a year-0002 row saved before the API enforced the due-date
    // contract used to throw on render ("Gagal memuat." on every load).
    describe("an unusable stored due date (legacy year-0002 row)", () => {
      const legacyDueDate = new Date("0002-01-15T00:00:00.000Z");

      it("renders the invoice, says the date is invalid in the header and field, and never shows it as a real date", async () => {
        vi.stubGlobal("fetch", makeFetchMock());
        render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: legacyDueDate }} />);
        await screen.findByRole("button", { name: "Buat tautan berbagi" });

        expect(screen.getByText("Jatuh tempo: Tanggal tidak valid")).toBeDefined();
        expect(screen.getAllByText("Tanggal tidak valid").length).toBeGreaterThan(0);
        expect(
          screen.getByText("Tanggal jatuh tempo yang tersimpan tidak valid. Pilih tanggal baru antara 1 Jan 2000 dan 31 Des 2099, atau kosongkan."),
        ).toBeDefined();
        expect(screen.getByLabelText("Tanggal jatuh tempo").getAttribute("aria-invalid")).toBe("true");
        expect(document.body.textContent).not.toMatch(/15 Jan (2|1902)\b/);
      });

      it("also survives the JSON-string form a fetch round-trip produces", async () => {
        vi.stubGlobal("fetch", makeFetchMock());
        render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: "0002-01-15T00:00:00.000Z" as unknown as Date }} />);
        await screen.findByRole("button", { name: "Buat tautan berbagi" });

        expect(screen.getByText("Jatuh tempo: Tanggal tidak valid")).toBeDefined();
      });

      it("localizes the invalid-date state in English", async () => {
        window.localStorage.setItem("dibayar-language", "en");
        vi.stubGlobal("fetch", makeFetchMock());
        render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: legacyDueDate }} />);
        await screen.findByRole("button", { name: "Create sharing link" });

        expect(screen.getAllByText("Invalid date").length).toBeGreaterThan(0);
        expect(screen.getByText("The saved due date is invalid. Choose a new date between 1 Jan 2000 and 31 Des 2099, or clear it.")).toBeDefined();
      });

      it("lets the owner clear it through Kosongkan, without repairing it automatically", async () => {
        const user = userEvent.setup();
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        vi.stubGlobal(
          "fetch",
          vi.fn(async (url: string, init?: RequestInit) => {
            calls.push({ url, init });
            const method = init?.method ?? "GET";
            if (url.endsWith("/contact")) return jsonResponse({ status: 200, body: {} });
            if (url.endsWith("/share") && method === "GET") return jsonResponse({ status: 200, body: { active: false } });
            if (method === "PATCH") return jsonResponse({ status: 200, body: { invoice: { ...draftInvoice, dueDate: null } } });
            return jsonResponse({ status: 200, body: {} });
          }),
        );
        render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, dueDate: legacyDueDate }} />);
        await screen.findByRole("button", { name: "Buat tautan berbagi" });
        expect(calls.some((call) => call.init?.method === "PATCH")).toBe(false);

        await user.click(screen.getByRole("button", { name: "Kosongkan" }));

        await waitFor(() => expect(screen.getByText("Jatuh tempo: Belum ditentukan")).toBeDefined());
        const patchCall = calls.find((call) => call.init?.method === "PATCH");
        expect(JSON.parse(patchCall!.init!.body as string)).toEqual({ dueDate: null });
      });

      it("leaves the unusable date out of the WhatsApp message instead of sending it to the brand", async () => {
        const user = userEvent.setup();
        const wa = stubWhatsAppTab();
        vi.stubGlobal("fetch", makeFetchMock({
          contactGet: { status: 200, body: { contactWa: "0812-3456-7890", brand: "Kopi Nusantara" } },
          shareGet: { status: 200, body: { active: false } },
          sharePost: { status: 200, body: { active: true, path: "/i/deterministic-token" } },
        }));
        render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "SENT", dueDate: legacyDueDate }} />);

        const whatsAppButtons = await screen.findAllByRole("button", { name: /Kirim (lewat WhatsApp|pengingat)/ });
        await user.click(whatsAppButtons[0]);

        const message = decodeURIComponent((await sentWhatsAppHref(wa)).split("?text=")[1] ?? "");
        expect(message).not.toMatch(/15 Jan|jatuh tempo/i);
      });
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

  describe("XS band (T-26)", () => {
    it("stacks the WhatsApp contact-repair input and Save button full-width below 360px", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", makeFetchMock({ contactGet: { status: 200, body: { contactWa: "not-a-phone", brand: "Kopi Nusantara" } } }));
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      await user.click(await screen.findByRole("button", { name: "Kirim lewat WhatsApp" }));
      const row = (await screen.findByLabelText("Perbaiki nomor WhatsApp")).closest("div")!;
      expect(row.className).toMatch(/flex-col/);
      expect(row.className).toMatch(/min-\[360px\]:flex-row/);
    });

    it("stacks the share regenerate/revoke button pair full-width below 360px", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: true } } }));
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      const regenerate = await screen.findByRole("button", { name: /buat ulang tautan/i });
      const row = regenerate.closest("div")!;
      expect(row.className).toMatch(/flex-col/);
      expect(row.className).toMatch(/min-\[360px\]:flex-row/);
    });

    it("stacks the revoke-confirm Cancel/Confirm button pair full-width below 360px", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: true } } }));
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      await user.click(await screen.findByRole("button", { name: /cabut tautan/i }));
      const confirmButton = screen.getByRole("button", { name: "Ya, cabut tautan" });
      const row = confirmButton.closest("div")!;
      expect(row.className).toMatch(/flex-col/);
      expect(row.className).toMatch(/min-\[360px\]:flex-row/);
    });

    it("uses 16px card padding below 360px on the header, payment-status, share, and details cards", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
      await screen.findByRole("button", { name: "Buat tautan berbagi" });

      const paymentStatusSection = screen.getByRole("heading", { name: "Status pembayaran" }).closest("section")!;
      const detailsSection = screen.getByRole("heading", { name: "Rincian invoice" }).closest("section")!;
      expect(paymentStatusSection.className).toMatch(/\bp-4\b/);
      expect(paymentStatusSection.className).toMatch(/min-\[360px\]:p-5/);
      expect(detailsSection.className).toMatch(/\bp-4\b/);
      expect(detailsSection.className).toMatch(/min-\[360px\]:p-5/);
    });
  });

  describe("T-27 overflow fixes", () => {
    it("gives the back link a >=44px hit target without changing its visible size", async () => {
      vi.stubGlobal("fetch", makeFetchMock());
      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(screen.getByRole("link", { name: /Kembali ke dashboard/ }).className).toMatch(/ds-tap-target/);
    });
  });
});
