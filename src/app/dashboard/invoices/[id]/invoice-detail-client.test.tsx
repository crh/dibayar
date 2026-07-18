import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  } = {},
) {
  const shareGet = options.shareGet ?? { status: 200, body: { active: false } };
  const shareDelete = options.shareDelete ?? { status: 200, body: { active: false } };
  const statusPatch = options.statusPatch ?? { status: 200, body: {} };
  const sharePostQueue = Array.isArray(options.sharePost)
    ? [...options.sharePost]
    : [options.sharePost ?? { status: 200, body: { active: true, path: "/i/deterministic-token" } }];

  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/share") && method === "GET") return jsonResponse(shareGet);
    if (url.endsWith("/share") && method === "POST") {
      const next = sharePostQueue.length > 1 ? sharePostQueue.shift()! : sharePostQueue[0];
      return jsonResponse(next);
    }
    if (url.endsWith("/share") && method === "DELETE") return jsonResponse(shareDelete);
    return jsonResponse(statusPatch);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InvoiceDetailClient", () => {
  it("renders invoice detail and only the legal next action for a draft", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    expect(screen.getByRole("heading", { name: "Rp1.500.000" })).toBeDefined();
    expect(screen.getAllByText("INV/2026/07/001")).toHaveLength(2);
    expect(screen.getByText("PPh 23")).toBeDefined();
    expect(screen.getByRole("button", { name: "Tandai sudah dikirim" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Unduh PDF" }).getAttribute("href")).toBe("/api/invoices/invoice-1/pdf");
    expect(screen.queryByRole("button", { name: "Tandai lunas" })).toBeNull();
  });

  it("shows no further transition control for a paid invoice", async () => {
    vi.stubGlobal("fetch", makeFetchMock());
    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "PAID" }} />);
    await screen.findByRole("button", { name: "Buat tautan berbagi" });

    expect(screen.getByText("Invoice ini sudah lunas.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Tandai sudah dikirim" })).toBeNull();
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

    it("shows the active state after a reload without reconstructing the plaintext link", async () => {
      vi.stubGlobal("fetch", makeFetchMock({ shareGet: { status: 200, body: { active: true } } }));

      render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

      expect(await screen.findByText(/tautan berbagi aktif/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /buat ulang tautan/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /cabut tautan/i })).toBeDefined();
      expect(screen.queryByText(/^https?:\/\//)).toBeNull();
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
  });
});
