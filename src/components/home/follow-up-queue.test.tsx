import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LanguageProvider } from "@/components/language-switcher";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { FollowUpQueue } from "./follow-up-queue";

const NOW = new Date("2026-07-19T10:00:00.000Z"); // Jakarta 2026-07-19T17:00

// getByText's default normalizer collapses the DOM's real NBSP (U+00A0) money
// separator into a plain space before comparing, so the query string must use
// a plain space too, not formatMoney's raw NBSP output.
function normalizedMoney(value: number): string {
  return formatMoney(value).replace(/ /gi, " ");
}

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brand: "Brand",
    contactWa: "+6281234567890",
    contactName: null,
    scope: "1 video Reels",
    feeIdr: 1_000_000,
    deadline: null,
    paymentTerms: null,
    status: "INVOICE",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "invoice-1",
    userId: "user-1",
    dealId: "deal-1",
    number: "INV/2026/07/001",
    subtotalIdr: 500_000,
    withholdingTaxType: "NONE",
    status: "SENT",
    dueDate: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function renderQueue(invoices: InvoiceRecord[] | null, deals: DealRecord[] | null) {
  return render(
    <LanguageProvider initialLanguage="id">
      <FollowUpQueue invoices={invoices} deals={deals} now={NOW} />
    </LanguageProvider>,
  );
}

describe("FollowUpQueue — selection and rendering", () => {
  it("includes overdue and due-within-7-days invoices, excludes DRAFT/PAID/far-future, and shows brand/amount/date/urgency with invoice links", () => {
    const dealA = makeDeal({ id: "deal-a", brand: "Kopi Nusantara" });
    const dealB = makeDeal({ id: "deal-b", brand: "Skin Glow" });

    const overdueInvoice = makeInvoice({
      id: "invoice-overdue",
      dealId: "deal-a",
      number: "INV/2026/07/010",
      subtotalIdr: 500_000,
      status: "SENT",
      dueDate: new Date("2026-07-14T00:00:00.000Z"), // 5 days overdue at NOW
    });
    const dueSoonInvoice = makeInvoice({
      id: "invoice-due-soon",
      dealId: "deal-b",
      number: "INV/2026/07/011",
      subtotalIdr: 750_000,
      status: "SENT",
      dueDate: new Date("2026-07-22T00:00:00.000Z"), // 3 days out at NOW
    });
    const draftInvoice = makeInvoice({
      id: "invoice-draft",
      dealId: "deal-a",
      number: "INV/2026/07/012",
      status: "DRAFT",
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
    });
    const paidInvoice = makeInvoice({
      id: "invoice-paid",
      dealId: "deal-a",
      number: "INV/2026/07/013",
      status: "PAID",
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
    });
    const farFutureInvoice = makeInvoice({
      id: "invoice-far-future",
      dealId: "deal-b",
      number: "INV/2026/07/014",
      status: "SENT",
      dueDate: new Date("2026-08-15T00:00:00.000Z"),
    });

    renderQueue(
      [overdueInvoice, dueSoonInvoice, draftInvoice, paidInvoice, farFutureInvoice],
      [dealA, dealB],
    );

    const section = screen.getByRole("region", { name: "Perlu dikejar" });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const invoiceLinks = within(section)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/invoice/"));
    expect(invoiceLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/invoice/invoice-overdue",
      "/invoice/invoice-due-soon",
    ]);

    expect(within(section).getByText("Kopi Nusantara")).toBeDefined();
    expect(within(section).getByText("Skin Glow")).toBeDefined();
    expect(within(section).getByText(normalizedMoney(overdueInvoice.subtotalIdr))).toBeDefined();
    expect(within(section).getByText(normalizedMoney(dueSoonInvoice.subtotalIdr))).toBeDefined();
    expect(within(section).getByText(new RegExp(formatDate(overdueInvoice.dueDate as Date)))).toBeDefined();
    expect(within(section).getByText(new RegExp(formatDate(dueSoonInvoice.dueDate as Date)))).toBeDefined();
    expect(within(section).getByText(/Telat 5 hari/)).toBeDefined();
    expect(within(section).getByText(/Jatuh tempo 3 hari lagi/)).toBeDefined();

    // Excluded invoices never reach the DOM.
    expect(within(section).queryByText("INV/2026/07/012")).toBeNull();
    expect(within(section).queryByText("INV/2026/07/013")).toBeNull();
    expect(within(section).queryByText("INV/2026/07/014")).toBeNull();
  });

  it("excludes a manually-marked OVERDUE invoice that has no due date (nothing to chase it against)", () => {
    const deal = makeDeal({ id: "deal-a", brand: "Tokopedia" });
    const manuallyOverdue = makeInvoice({
      id: "invoice-manual-overdue",
      dealId: "deal-a",
      status: "OVERDUE",
      dueDate: null,
    });

    renderQueue([manuallyOverdue], [deal]);

    expect(screen.getByText("Tidak ada yang perlu dikejar.")).toBeDefined();
  });

  it("renders the Indonesian empty-state copy (with its eligibility hint) and no list when nothing needs chasing", () => {
    renderQueue([], []);

    expect(screen.getByText("Tidak ada yang perlu dikejar.")).toBeDefined();
    expect(
      screen.getByText(
        "Invoice yang sudah dikirim dan punya tenggat pembayaran akan muncul di sini saat mendekati atau melewati jatuh tempo.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("gives the 'Lihat semua' link a >=44px hit target without growing its visible size (T-27)", () => {
    renderQueue([], []);

    expect(screen.getByRole("link", { name: "Lihat semua →" }).className).toMatch(/ds-tap-target/);
  });
});

// The WhatsApp hand-off (src/lib/whatsapp-popup.ts) opens a blank tab on the
// tap itself, then sends that tab to wa.me through a link in the tab's own
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

// Only the reuse endpoint (POST .../share/ensure) answers; the rotating
// POST .../share gets a 404 here, so a reminder that used it would fail.
function stubFetch(handlers: { sharePost?: { status: number; body: unknown }; dealPatch?: { status: number; body: unknown } }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const reply = url.endsWith("/share/ensure") && init?.method === "POST"
      ? handlers.sharePost ?? { status: 200, body: { path: "/i/reminder-token" } }
      : url.startsWith("/api/deals/") && init?.method === "PATCH"
        ? handlers.dealPatch ?? { status: 500, body: {} }
        : { status: 404, body: {} };
    return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, json: async () => reply.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("FollowUpQueue — Kirim pengingat (FIND-04)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const overdue = makeInvoice({ id: "invoice-overdue", number: "INV/2026/07/010", dueDate: new Date("2026-07-14T00:00:00.000Z") });

  it("opens exactly one tab, cut off from Beranda, sends it to the overdue reminder, and shows no fallback link", async () => {
    const wa = stubWhatsAppTab();
    stubFetch({});
    renderQueue([overdue], [makeDeal()]);

    fireEvent.click(screen.getByRole("button", { name: "Kirim pengingat" }));

    // Opened by the tap itself, before the share request resolves.
    expect(wa.open).toHaveBeenCalledTimes(1);
    expect(wa.open).toHaveBeenCalledWith("", "_blank");
    expect(wa.tab.opener).toBeNull();
    await waitFor(() => expect(wa.href()).not.toBeNull());
    const href = wa.href()!;
    expect(href).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    const message = decodeURIComponent(href.split("?text=")[1] ?? "");
    expect(message).toContain("INV/2026/07/010");
    expect(message).toContain("sudah melewati jatuh tempo");
    expect(message).toContain(`${window.location.origin}/i/reminder-token`);
    expect(wa.tab.document.querySelector("a")?.rel).toBe("noreferrer");
    expect(wa.tab.close).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Kirim pengingat" })).toBeDefined());
    expect(screen.queryByRole("link", { name: "Buka WhatsApp" })).toBeNull();
    expect(wa.open).toHaveBeenCalledTimes(1);
  });

  // FIND-05: a reminder asks for the invoice's existing link; it must never
  // call the rotating POST .../share, which would break a link already sent.
  it("asks the server to reuse the invoice's share link, once per reminder, and never calls the rotating endpoint", async () => {
    stubWhatsAppTab();
    const fetchMock = stubFetch({});
    renderQueue([overdue], [makeDeal()]);

    for (const expectedCalls of [1, 2]) {
      fireEvent.click(screen.getByRole("button", { name: "Kirim pengingat" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(expectedCalls));
      await waitFor(() => expect(screen.getByRole("button", { name: "Kirim pengingat" })).toBeDefined());
    }

    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      "POST /api/invoices/invoice-overdue/share/ensure",
      "POST /api/invoices/invoice-overdue/share/ensure",
    ]);
  });

  it("shows a Buka WhatsApp link to the same reminder when the browser blocks the tab", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    stubFetch({});
    renderQueue([overdue], [makeDeal()]);

    fireEvent.click(screen.getByRole("button", { name: "Kirim pengingat" }));

    const fallback = await screen.findByRole("link", { name: "Buka WhatsApp" });
    expect(fallback.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(decodeURIComponent(fallback.getAttribute("href")!.split("?text=")[1] ?? "")).toContain("INV/2026/07/010");
    expect(fallback.getAttribute("target")).toBe("_blank");
    expect(fallback.getAttribute("rel")).toBe("noopener noreferrer");
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("closes the blank tab and shows the error, not the fallback, when the share link can't be created", async () => {
    const wa = stubWhatsAppTab();
    stubFetch({ sharePost: { status: 500, body: {} } });
    renderQueue([overdue], [makeDeal()]);

    fireEvent.click(screen.getByRole("button", { name: "Kirim pengingat" }));

    expect(await screen.findByText("Gagal membuka WhatsApp.")).toBeDefined();
    expect(wa.tab.close).toHaveBeenCalled();
    expect(wa.href()).toBeNull();
    expect(screen.queryByRole("link", { name: "Buka WhatsApp" })).toBeNull();
  });

  it("after repairing the number, Simpan & kirim opens one tab from that tap and sends it to the saved number", async () => {
    const wa = stubWhatsAppTab();
    const fetchMock = stubFetch({ dealPatch: { status: 200, body: { deal: { contactWa: "0812-9999-0000" } } } });
    renderQueue([overdue], [makeDeal({ contactWa: "12345678" })]);

    fireEvent.click(screen.getByRole("button", { name: "Kirim pengingat" }));
    expect(wa.open).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nomor WhatsApp"), { target: { value: "0812-9999-0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan & kirim" }));
    expect(wa.open).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(wa.href()).not.toBeNull());
    expect(wa.href()).toMatch(/^https:\/\/wa\.me\/6281299990000\?text=/);
    expect(fetchMock.mock.calls.some(([url, init]) => url === "/api/deals/deal-1" && init?.method === "PATCH")).toBe(true);
    expect(screen.queryByRole("link", { name: "Buka WhatsApp" })).toBeNull();
  });

  it("never sends or opens a tab for a number that can't be a WhatsApp number, says why, and closes the tab when saving fails", async () => {
    const wa = stubWhatsAppTab();
    const fetchMock = stubFetch({ dealPatch: { status: 500, body: {} } });
    renderQueue([overdue], [makeDeal({ contactWa: "12345678" })]);

    fireEvent.click(screen.getByRole("button", { name: "Kirim pengingat" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan & kirim" }));
    expect(wa.open).not.toHaveBeenCalled();
    // #50: what is wrong with the number, not "try again"; nothing is sent.
    expect(await screen.findByText("Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.")).toBeDefined();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);

    fireEvent.change(screen.getByLabelText("Nomor WhatsApp"), { target: { value: "0812-9999-0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan & kirim" }));
    expect(wa.open).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(wa.tab.close).toHaveBeenCalled());
    expect(wa.href()).toBeNull();
    expect(await screen.findByText("Nomor belum bisa disimpan. Coba lagi.")).toBeDefined();
  });

  it("shows the WhatsApp message when the server refuses the number (400)", async () => {
    stubWhatsAppTab();
    stubFetch({ dealPatch: { status: 400, body: { fields: { contactWa: ["Nomor WhatsApp tidak valid"] } } } });
    renderQueue([overdue], [makeDeal({ contactWa: "12345678" })]);

    fireEvent.click(screen.getByRole("button", { name: "Kirim pengingat" }));
    fireEvent.change(screen.getByLabelText("Nomor WhatsApp"), { target: { value: "0812-9999-0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan & kirim" }));
    expect(await screen.findByText("Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.")).toBeDefined();
  });
});
