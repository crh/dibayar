import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
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

    await user.selectOptions(screen.getByRole("combobox", { name: "Language" }), "id");

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
});
