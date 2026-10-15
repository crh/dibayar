import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DealRecord, DealStageTransitionRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import DealDetailClient from "./deal-detail-client";

const dealFixture: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Kopi Nusantara",
  contactWa: "+62 812-3456-7890",
  contactName: null,
  scope: "1 Reel + 2 Story",
  feeIdr: 2_500_000,
  deadline: new Date("2026-09-01T00:00:00.000Z"),
  paymentTerms: null,
  status: "NEGO",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const historyFixture: DealStageTransitionRecord[] = [
  { id: "t-2", dealId: "deal-1", fromStatus: "MASUK", toStatus: "NEGO", createdAt: new Date("2026-08-02T00:00:00.000Z") },
  { id: "t-1", dealId: "deal-1", fromStatus: null, toStatus: "MASUK", createdAt: new Date("2026-08-01T00:00:00.000Z") },
];

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("DealDetailClient", () => {
  it("shows the deal's brand, current stage, fee, deadline, and scope", () => {
    // Pinned before dealFixture's own deadline so this deadline-text
    // assertion stays valid regardless of which real day the suite runs on
    // -- see the dedicated overdue-styling tests below for that path.
    render(<DealDetailClient initialDeal={dealFixture} history={[]} now={new Date("2026-08-15T00:00:00.000Z")} />);

    expect(screen.getByRole("heading", { name: "Kopi Nusantara" })).toBeDefined();
    expect(screen.getByText(/Nego/)).toBeDefined();
    expect(screen.getByText("Rp 2.500.000")).toBeDefined();
    expect(screen.getByText("1 Sep 2026")).toBeDefined();
    expect(screen.getByText("1 Reel + 2 Story")).toBeDefined();
  });

  it("renders the stage history newest first, with a distinct label for the creation entry", () => {
    render(<DealDetailClient initialDeal={dealFixture} history={historyFixture} />);

    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items[0]).toContain("Masuk → Nego");
    expect(items[1]).toContain("Deal dibuat langsung di tahap Masuk");
  });

  it("shows an empty-history message when there is no stage history yet", () => {
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);
    expect(screen.getByText("Belum ada riwayat perpindahan tahap.")).toBeDefined();
  });

  it("saves an edited contact name and shows a success message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { deal: { ...dealFixture, contactName: "Budi" } }))),
    );
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    await user.type(screen.getByLabelText("Nama kontak"), "Budi");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Nama kontak disimpan");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/deals/deal-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ contactName: "Budi" }),
      }),
    );
  });

  it("shows an error and keeps the typed value when saving the contact name fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(500, {}))));
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    await user.type(screen.getByLabelText("Nama kontak"), "Budi");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Nama kontak belum bisa disimpan. Coba lagi.",
    );
    expect(screen.getByLabelText("Nama kontak")).toHaveProperty("value", "Budi");
  });
});

describe("DealDetailClient WhatsApp action (T-18)", () => {
  it("offers a Buka WhatsApp button for a valid contact number, and never opens it on its own", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    expect(screen.getByRole("button", { name: "Buka WhatsApp" })).toBeDefined();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("opens a bare wa.me chat only when the button is clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    await user.click(screen.getByRole("button", { name: "Buka WhatsApp" }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [href, target, features] = openSpy.mock.calls[0];
    expect(href).toBe("https://wa.me/6281234567890");
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("keeps the normal WhatsApp CTA enabled and reveals a focused repair form only after activation", async () => {
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={{ ...dealFixture, contactWa: "not-a-phone" }} history={[]} />);

    const whatsappButton = screen.getByRole("button", { name: "Buka WhatsApp" });
    expect(whatsappButton.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByLabelText("Perbaiki nomor WhatsApp")).toBeNull();

    await user.click(whatsappButton);
    expect(screen.getByRole("alert").textContent).toBe("Nomor WhatsApp belum valid — perbaiki di deal ini.");
    expect(document.activeElement).toBe(screen.getByLabelText("Perbaiki nomor WhatsApp"));
  });

  it("repairing the number only unblocks the WhatsApp button -- saving never opens WhatsApp by itself", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === "PATCH"
            ? jsonResponse(200, { deal: { ...dealFixture, contactWa: "6281234567890" } })
            : jsonResponse(200, { deal: { ...dealFixture, contactWa: "6281234567890" } }),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={{ ...dealFixture, contactWa: "not-a-phone" }} history={[]} />);

    await user.click(screen.getByRole("button", { name: "Buka WhatsApp" }));
    const input = screen.getByLabelText("Perbaiki nomor WhatsApp");
    await user.clear(input);
    await user.type(input, "+62 812-3456-7890");
    await user.click(screen.getByRole("button", { name: "Simpan nomor" }));

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Nomor WhatsApp disimpan");
    expect(screen.getByRole("button", { name: "Buka WhatsApp" })).toBeDefined();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

describe("DealDetailClient field messages (#50)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a repair number WhatsApp can't open is not sent, and the message says what is wrong", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={{ ...dealFixture, contactWa: "not-a-phone" }} history={[]} />);

    await user.click(screen.getByRole("button", { name: "Buka WhatsApp" }));
    const input = screen.getByLabelText("Perbaiki nomor WhatsApp");
    await user.clear(input);
    await user.type(input, "1");
    await user.click(screen.getByRole("button", { name: "Simpan nomor" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toContain(
      "Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.",
    );
    expect(document.activeElement).toBe(input);
  });

  it("a contact name the server refuses says it is too long, not 'try again'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(400, { fields: { contactName: ["x"] } }))));
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    expect(screen.getByLabelText("Nama kontak").getAttribute("maxlength")).toBe("120");
    await user.type(screen.getByLabelText("Nama kontak"), "Budi");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Nama kontak maksimal 120 karakter.");
  });
});

describe("DealDetailClient T-27 overflow fixes", () => {
  it("wraps long unbreakable payment-terms and scope text instead of letting it force the page wider", () => {
    const longUrl = "https://example.invalid/a/very/long/path/for/layout/testing/that/has/no/spaces";
    render(
      <DealDetailClient
        initialDeal={{ ...dealFixture, paymentTerms: `Referensi: ${longUrl}`, scope: longUrl }}
        history={[]}
      />,
    );

    const paymentTermsValue = screen.getByText(`Referensi: ${longUrl}`);
    expect(paymentTermsValue.className).toMatch(/break-words/);
    const scopeValue = screen.getByText(longUrl);
    expect(scopeValue.className).toMatch(/break-words/);
  });

  it("gives the fields grid an explicit single-column base track so it cannot grow past its container on narrow viewports", () => {
    const { container } = render(<DealDetailClient initialDeal={dealFixture} history={[]} />);
    const dl = container.querySelector("dl")!;
    expect(dl.className).toMatch(/grid-cols-1/);
  });

  it("gives the back link a >=44px hit target without changing its visible size", () => {
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);
    expect(screen.getByRole("link", { name: /Kembali ke papan deal/ }).className).toMatch(/ds-tap-target/);
  });
});

describe("DealDetailClient XS band (T-26)", () => {
  it("stacks the contact-name input and Save button full-width below 360px, side by side at and above it", () => {
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    const nameRow = screen.getByLabelText("Nama kontak").closest("div")!;
    expect(nameRow.className).toMatch(/flex-col/);
    expect(nameRow.className).toMatch(/min-\[360px\]:flex-row/);
  });

  it("stacks the WhatsApp-repair input and Save button full-width below 360px, side by side at and above it", async () => {
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={{ ...dealFixture, contactWa: "not-a-phone" }} history={[]} />);
    await user.click(screen.getByRole("button", { name: "Buka WhatsApp" }));
    const row = screen.getByLabelText("Perbaiki nomor WhatsApp").closest("div")!;
    expect(row.className).toMatch(/flex-col/);
    expect(row.className).toMatch(/min-\[360px\]:flex-row/);
  });
});

describe("DealDetailClient — next action (deal↔invoice continuity)", () => {
  it("shows stage-transition buttons that PATCH the deal and update the shown stage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(200, { deal: { ...dealFixture, status: "DEAL" } }))),
    );
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={dealFixture} history={[]} />);

    expect(screen.getByRole("button", { name: "Kembali ke Masuk" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Lanjut ke Deal" }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/deals/deal-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "DEAL" }) }),
    );
    expect(await screen.findByText(/Deal/)).toBeDefined();
  });

  it("offers Buat invoice for a deal at the Invoice stage with no invoice yet, and shows a link to the created invoice on success", async () => {
    const createdInvoice: InvoiceRecord = {
      id: "inv-1",
      userId: "user-1",
      dealId: "deal-1",
      number: "INV/2026/09/001",
      subtotalIdr: 2_500_000,
      withholdingTaxType: "NONE",
      status: "DRAFT",
      dueDate: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(201, { invoice: createdInvoice }))));
    const user = userEvent.setup();
    render(<DealDetailClient initialDeal={{ ...dealFixture, status: "INVOICE" }} history={[]} />);

    const createButton = screen.getByRole("button", { name: "Buat invoice" });
    await user.click(createButton);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/invoices",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ dealId: "deal-1", withholdingTaxType: "NONE" }),
      }),
    );
    expect(await screen.findByRole("link", { name: "Lihat invoice INV/2026/09/001 →" })).toHaveProperty(
      "href",
      expect.stringContaining("/invoice/inv-1"),
    );
    expect(screen.queryByRole("button", { name: "Buat invoice" })).toBeNull();
  });

  it("shows a link straight to the invoice when one already exists for this deal, instead of Buat invoice", () => {
    const existingInvoice: InvoiceRecord = {
      id: "inv-2",
      userId: "user-1",
      dealId: "deal-1",
      number: "INV/2026/09/002",
      subtotalIdr: 2_500_000,
      withholdingTaxType: "NONE",
      status: "SENT",
      dueDate: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    render(
      <DealDetailClient
        initialDeal={{ ...dealFixture, status: "INVOICE" }}
        history={[]}
        initialInvoice={existingInvoice}
      />,
    );

    expect(screen.getByRole("link", { name: "Lihat invoice INV/2026/09/002 →" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Buat invoice" })).toBeNull();
  });

  it("shows a 'Telat N hari' label for a deal whose deadline has already passed", () => {
    render(
      <DealDetailClient
        initialDeal={{ ...dealFixture, status: "KONTEN", deadline: new Date("2026-08-28T00:00:00.000Z") }}
        history={[]}
        now={new Date("2026-09-01T00:00:00.000Z")}
      />,
    );

    expect(screen.getByText(/Telat 4 hari/)).toBeDefined();
  });

  it("never shows an overdue label for a Dibayar (paid/terminal) deal, even with a past deadline", () => {
    render(
      <DealDetailClient
        initialDeal={{ ...dealFixture, status: "DIBAYAR", deadline: new Date("2026-08-28T00:00:00.000Z") }}
        history={[]}
        now={new Date("2026-09-01T00:00:00.000Z")}
      />,
    );

    expect(screen.queryByText(/Telat/)).toBeNull();
  });
});
