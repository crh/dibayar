import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import type { DealRecord } from "@/lib/deals";
import { DEAL_DRAG_MIME } from "@/components/deals/deal-card";
import DealClient from "./deal-client";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockedUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockedUseSearchParams(),
}));

const dealFixture: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Acme",
  contactWa: "6281234567890",
  contactName: null,
  scope: "Video promosi",
  feeIdr: 1500000,
  deadline: null,
  paymentTerms: null,
  status: "MASUK",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

// Deep-link / hard-load setup: sets the actual browser URL (the real source
// of truth DealClient reads) without adding a history entry.
function setLocation(url: string) {
  window.history.replaceState(null, "", url);
}

// Simulates a real Next.js <Link>/router navigation to a same-route URL
// (e.g. TopBar's "New Deal"/"New Invoice" links): Next moves the actual
// browser URL via the History API *and* updates its reactive searchParams,
// which is what causes DealClient to re-render while staying mounted.
// `rerender` stands in for that re-render -- called with a freshly built
// element each time (not a cached one), since React bails out of an update
// entirely when the exact same element reference is passed to rerender
// twice in a row, which would mask the very re-render this simulates.
function simulateLinkNavigation(
  rerender: (ui: ReactElement) => void,
  buildUi: () => ReactElement,
  url: string,
) {
  window.history.pushState(null, "", url);
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  mockedUseSearchParams.mockReturnValue(new URLSearchParams(query));
  rerender(buildUi());
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockedUseSearchParams.mockReturnValue(new URLSearchParams());
  setLocation("/deal");
});

describe("DealClient stage filter (T-14)", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/deal");
  });

  it("updates the URL via history.pushState (not a router navigation) when a stage filter chip is clicked, so back/forward can step through it without a server round trip", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Nego" }));

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/deal?tahap=NEGO");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Nego" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("updates the URL back to the plain /deal path when Semua is selected", async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=NEGO"));
    setLocation("/deal?tahap=NEGO");
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Semua" }));

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/deal");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not fetch or navigate when switching filters — the already-loaded deals are filtered client-side", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Nego" }));
    await user.click(screen.getByRole("button", { name: "Semua" }));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reflects the current URL's tahap value as the pressed filter on initial render", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=DEAL"));
    setLocation("/deal?tahap=DEAL");
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    expect(screen.getByRole("button", { name: "Deal" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("falls back to no filter when the URL's tahap value is invalid", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=NOT_A_STAGE"));
    setLocation("/deal?tahap=NOT_A_STAGE");
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("region")).toHaveLength(6);
  });

  it("restores the filter shown before the click when the user navigates back (popstate), without a server round trip", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Nego" }));
    expect(screen.getByRole("button", { name: "Nego" }).getAttribute("aria-pressed")).toBe("true");

    // Simulate the browser restoring the prior URL and firing popstate, as it
    // does for a same-document history entry created by pushState.
    window.history.replaceState(null, "", "/deal");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("picks up a tahap filter added by a same-route Next.js navigation (e.g. TopBar's New Invoice link) on the already-mounted instance", () => {
    const buildUi = () => <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />;
    const { rerender } = render(buildUi());
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("false");

    // Same mounted DealClient instance: a real <Link href="/deal?tahap=INVOICE">
    // click, which moves the actual browser URL and updates searchParams.
    simulateLinkNavigation(rerender, buildUi, "/deal?tahap=INVOICE");

    expect(window.location.search).toBe("?tahap=INVOICE");
    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByRole("region")).toHaveLength(1);
  });

  it("clears the filter when a same-route Next.js navigation removes tahap from the URL (e.g. TopBar's New Deal link) on the already-mounted instance", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=INVOICE"));
    setLocation("/deal?tahap=INVOICE");
    const buildUi = () => <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />;
    const { rerender } = render(buildUi());
    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");

    // Same mounted DealClient instance: a real <Link href="/deal"> click.
    simulateLinkNavigation(rerender, buildUi, "/deal");

    expect(window.location.search).toBe("");
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByRole("region")).toHaveLength(6);
  });

  it("preserves the active stage filter through the one-shot ?tambah=1 URL cleanup", () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=INVOICE&tambah=1"));
    setLocation("/deal?tahap=INVOICE&tambah=1");
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={true} />);

    expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");
    expect(mockReplace).toHaveBeenCalledWith("/deal?tahap=INVOICE");
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  describe("mixed navigation (chip click + TopBar Link, same mounted instance)", () => {
    // Every sequence below re-asserts the full invariant this fix exists to
    // guarantee: after any supported navigation completes, window.location,
    // stageFilter (via aria-pressed on both the target and the
    // previously-active chip), and DealBoard's rendered filter must all
    // agree. V4 passed some of these by coincidence and silently failed
    // others -- see DIBAYAR-INTERVIEW-CANDIDATE-V4-FRESH-REVIEW.md.

    it("sequence 1: /deal -> chip Invoice -> TopBar New Deal ends unfiltered", async () => {
      const user = userEvent.setup();
      const buildUi = () => <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />;
      const { rerender } = render(buildUi());

      await user.click(screen.getByRole("button", { name: "Invoice" }));
      expect(window.location.search).toBe("?tahap=INVOICE");

      simulateLinkNavigation(rerender, buildUi, "/deal");

      expect(window.location.search).toBe("");
      expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("false");
      expect(screen.getAllByRole("region")).toHaveLength(6);
    });

    it("sequence 2: /deal -> chip Dibayar -> TopBar New Invoice ends filtered to Invoice", async () => {
      const user = userEvent.setup();
      const buildUi = () => <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />;
      const { rerender } = render(buildUi());

      await user.click(screen.getByRole("button", { name: "Dibayar" }));
      expect(window.location.search).toBe("?tahap=DIBAYAR");

      simulateLinkNavigation(rerender, buildUi, "/deal?tahap=INVOICE");

      expect(window.location.search).toBe("?tahap=INVOICE");
      expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Dibayar" }).getAttribute("aria-pressed")).toBe("false");
      expect(screen.getByRole("region", { name: "Invoice" })).toBeTruthy();
      expect(screen.getAllByRole("region")).toHaveLength(1);
    });

    it("sequence 3: /deal?tahap=INVOICE -> chip Dibayar -> TopBar New Invoice ends filtered to Invoice", async () => {
      mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=INVOICE"));
      setLocation("/deal?tahap=INVOICE");
      const user = userEvent.setup();
      const buildUi = () => <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />;
      const { rerender } = render(buildUi());

      await user.click(screen.getByRole("button", { name: "Dibayar" }));
      expect(window.location.search).toBe("?tahap=DIBAYAR");

      simulateLinkNavigation(rerender, buildUi, "/deal?tahap=INVOICE");

      expect(window.location.search).toBe("?tahap=INVOICE");
      expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Dibayar" }).getAttribute("aria-pressed")).toBe("false");
      expect(screen.getAllByRole("region")).toHaveLength(1);
    });

    it("sequence 4: /deal?tahap=INVOICE -> chip Dibayar -> TopBar New Deal ends unfiltered", async () => {
      mockedUseSearchParams.mockReturnValue(new URLSearchParams("tahap=INVOICE"));
      setLocation("/deal?tahap=INVOICE");
      const user = userEvent.setup();
      const buildUi = () => <DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />;
      const { rerender } = render(buildUi());

      await user.click(screen.getByRole("button", { name: "Dibayar" }));
      expect(window.location.search).toBe("?tahap=DIBAYAR");

      simulateLinkNavigation(rerender, buildUi, "/deal");

      expect(window.location.search).toBe("");
      expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Dibayar" }).getAttribute("aria-pressed")).toBe("false");
      expect(screen.getAllByRole("region")).toHaveLength(6);
    });

    it("survives a longer mixed sequence including back/forward: chip -> chip -> back -> forward all agree with the URL at every step", async () => {
      const user = userEvent.setup();
      render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

      await user.click(screen.getByRole("button", { name: "Invoice" }));
      expect(window.location.search).toBe("?tahap=INVOICE");
      await user.click(screen.getByRole("button", { name: "Dibayar" }));
      expect(window.location.search).toBe("?tahap=DIBAYAR");

      // Back: browser restores /deal?tahap=INVOICE and fires popstate.
      window.history.replaceState(null, "", "/deal?tahap=INVOICE");
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Dibayar" }).getAttribute("aria-pressed")).toBe("false");

      // Forward: browser restores /deal?tahap=DIBAYAR and fires popstate.
      window.history.replaceState(null, "", "/deal?tahap=DIBAYAR");
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(screen.getByRole("button", { name: "Dibayar" }).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByRole("button", { name: "Invoice" }).getAttribute("aria-pressed")).toBe("false");
      expect(screen.getAllByRole("region")).toHaveLength(1);
    });
  });
});

describe("DealClient stage movement (T-15)", () => {
  function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  it("moves the card immediately (optimistic), before the request resolves", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Lanjut ke Nego" }));

    // Moved immediately client-side, before the in-flight PATCH resolves.
    expect(screen.getAllByRole("region", { name: "Nego" })[0].textContent).toContain("Acme");

    resolveFetch(jsonResponse(200, { deal: { ...dealFixture, status: "NEGO" } }));
    vi.unstubAllGlobals();
  });

  it("rolls back to the prior stage and shows an error when the move request is refused", async () => {
    // A 5xx is an unknown outcome (#53), covered in the #53 block below.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(404, {}))));

    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Lanjut ke Nego" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Deal belum bisa diperbarui. Coba lagi.");
    expect(screen.getAllByRole("region", { name: "Masuk" })[0].textContent).toContain("Acme");
    expect(screen.getAllByRole("region", { name: "Nego" })[0].textContent).not.toContain("Acme");

    vi.unstubAllGlobals();
  });

  it("does not issue a request when a card is dropped back onto the column it is already in", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    // dealFixture is already at MASUK; dropping it on the MASUK column is a no-op.
    const masukColumn = screen.getByRole("region", { name: "Masuk" });
    fireEvent.drop(masukColumn, {
      dataTransfer: { types: [DEAL_DRAG_MIME], getData: () => dealFixture.id, setData: vi.fn() },
    });

    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

// FIND-13: /deal?tambah=1 arrives from the server with the dialog open, and
// someone can type into it before this component runs in the browser.
describe("DealClient add-deal dialog rendered open by the server (FIND-13)", () => {
  function serverRendered(ui: ReactElement) {
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(ui);
    return container;
  }
  const field = (container: HTMLElement, name: string) => container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;

  beforeEach(() => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams("tambah=1"));
    setLocation("/deal?tambah=1");
  });

  it("keeps what was typed before it ran, lets the typing continue, and saves those values", async () => {
    const ui = <DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen={true} />;
    const container = serverRendered(ui);
    // What the fields hold after typing with no script on the page.
    field(container, "brand").value = "Brand Awal";
    field(container, "contactWa").value = "62817";
    field(container, "contactWa").focus();

    render(ui, { container, hydrate: true });
    // The one-shot ?tambah=1 cleanup ran, i.e. the re-render that used to
    // empty the fields has happened.
    expect(mockReplace).toHaveBeenCalledWith("/deal");

    expect(field(container, "brand").value).toBe("Brand Awal");
    expect(field(container, "contactWa").value).toBe("62817");
    expect(document.activeElement).toBe(field(container, "contactWa"));

    const user = userEvent.setup();
    await user.keyboard("7000123");
    expect(field(container, "contactWa").value).toBe("628177000123");
    expect(field(container, "brand").value).toBe("Brand Awal");

    await user.type(field(container, "scope"), "Video promosi");
    await user.type(field(container, "feeIdr"), "2500000");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deal: { ...dealFixture, id: "deal-new", brand: "Brand Awal" } }) });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await user.click(screen.getByRole("button", { name: "Simpan deal" }));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        brand: "Brand Awal",
        contactWa: "628177000123",
        scope: "Video promosi",
        feeIdr: 2500000,
      });
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("starts empty again after the dialog is closed and reopened", async () => {
    const buildUi = () => <DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen={true} />;
    const container = serverRendered(buildUi());
    field(container, "brand").value = "Tidak Disimpan";

    const { rerender } = render(buildUi(), { container, hydrate: true });
    expect(field(container, "brand").value).toBe("Tidak Disimpan");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Tutup" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // The cleanup's router.replace lands (no ?tambah=1), then + Deal is used.
    simulateLinkNavigation(rerender, () => <DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen={false} />, "/deal");
    simulateLinkNavigation(rerender, buildUi, "/deal?tambah=1");
    expect(screen.getByRole("dialog")).toBeDefined();
    for (const name of ["brand", "contactWa", "contactName", "scope", "feeIdr", "deadline", "paymentTerms"]) {
      expect(field(container, name).value).toBe("");
    }
  });

  it("changes nothing when nothing was typed before it ran", () => {
    const ui = <DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen={true} />;
    const container = serverRendered(ui);

    render(ui, { container, hydrate: true });

    for (const name of ["brand", "contactWa", "contactName", "scope", "feeIdr", "deadline", "paymentTerms"]) {
      expect(field(container, name).value).toBe("");
    }
  });
});

describe("DealClient add-deal field errors (#50)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function openForm() {
    render(<DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen />);
    const dialog = screen.getByRole("dialog", { name: "Tambah deal" });
    const field = (label: string) => screen.getByLabelText(label, { selector: "input, textarea" }) as HTMLInputElement;
    return { dialog, field };
  }

  async function fillRequired(user: ReturnType<typeof userEvent.setup>, field: (label: string) => HTMLInputElement, contactWa: string) {
    await user.type(field("Nama brand"), "Kopi Nusantara");
    await user.type(field("Kontak WhatsApp"), contactWa);
    await user.type(field("Scope pekerjaan"), "1 reels");
    await user.type(field("Fee (Rp)"), "1500000");
  }

  it("a one-digit WhatsApp number is stopped on the phone with a message on that field, and nothing is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { dialog, field } = openForm();

    await fillRequired(user, field, "1");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));

    expect(fetchMock).not.toHaveBeenCalled();
    const wa = field("Kontak WhatsApp");
    expect(wa.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(wa);
    const message = document.getElementById(wa.getAttribute("aria-describedby")!);
    expect(message?.textContent).toBe("Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.");
    expect(screen.getByRole("alert").textContent).toBe("Periksa kembali isian yang ditandai.");
    expect(dialog.textContent).not.toContain("Deal belum bisa disimpan.");

    // Fixing the number clears its message, and the deal then saves.
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ deal: { ...dealFixture, id: "new" } }) });
    await user.clear(wa);
    // The last invalid field was edited: no highlighted fields remain, so no stale alert.
    expect(wa.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.type(wa, "0812 3456 7890");
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Deal disimpan");
  });

  it("keeps the validation summary until every highlighted field is corrected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { field } = openForm();
    await fillRequired(user, field, "1");

    const brand = field("Nama brand");
    const wa = field("Kontak WhatsApp");
    await user.clear(brand);
    await user.type(brand, "   ");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));

    expect(brand.getAttribute("aria-invalid")).toBe("true");
    expect(wa.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Periksa kembali isian yang ditandai.");

    await user.clear(wa);
    await user.type(wa, "0812 3456 7890");
    expect(wa.getAttribute("aria-invalid")).toBeNull();
    expect(brand.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Periksa kembali isian yang ditandai.");

    await user.clear(brand);
    await user.type(brand, "Kopi Nusantara");
    expect(brand.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a 400 naming a field marks that field instead of the generic message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "x", fields: { contactName: ["too long"] } }) })),
    );
    const user = userEvent.setup();
    const { field } = openForm();

    await fillRequired(user, field, "0812 3456 7890");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));

    const contactName = field("Nama kontak (opsional)");
    expect(contactName.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(contactName.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Nama kontak maksimal 120 karakter.",
    );
    expect((await screen.findByRole("alert")).textContent).toBe("Periksa kembali isian yang ditandai.");
  });

  it("a refusal that names no field still says the deal could not be saved", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "x" }) })));
    const user = userEvent.setup();
    const { field } = openForm();

    await fillRequired(user, field, "0812 3456 7890");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Deal belum bisa disimpan.");
  });
});

describe("DealClient when the server cannot answer (#53)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const created = { ...dealFixture, id: "new", brand: "Kopi Nusantara", contactWa: "6281234567890", scope: "1 reels", feeIdr: 1500000 };

  function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  async function fillAndSave(user: ReturnType<typeof userEvent.setup>) {
    const field = (label: string) => screen.getByLabelText(label, { selector: "input, textarea" }) as HTMLInputElement;
    await user.type(field("Nama brand"), "Kopi Nusantara");
    await user.type(field("Kontak WhatsApp"), "0812 3456 7890");
    await user.type(field("Scope pekerjaan"), "1 reels");
    await user.type(field("Fee (Rp)"), "1500000");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));
    return field;
  }

  function calls(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${url}`);
  }

  function keyOf(fetchMock: ReturnType<typeof vi.fn>, call: number) {
    const headers = (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<string, string>;
    return headers["Idempotency-Key"];
  }

  // The server returns what an earlier request with the same key stored
  // (src/lib/idempotency.ts), so the second press can only find, never
  // duplicate, the first attempt's deal.
  it.each([
    ["no answer", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["a JSON 502 from a gateway", () => Promise.resolve(jsonResponse(502, { message: "upstream timed out" }))],
    ["the app's own 500", () => Promise.resolve(jsonResponse(500, { error: "Deal belum bisa disimpan. Coba lagi." }))],
  ])("a create with %s says it may not be saved, keeps the form, and Simpan again resends it with the same key", async (_case, firstAnswer) => {
    const fetchMock = vi.fn().mockImplementationOnce(firstAnswer).mockResolvedValueOnce(jsonResponse(200, { deal: created }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen />);

    const field = await fillAndSave(user);
    expect((await screen.findByRole("alert")).textContent).toContain("deal ini belum pasti tersimpan");
    expect(screen.queryByRole("status")).toBeNull();
    expect(field("Nama brand").value).toBe("Kopi Nusantara");
    expect(screen.getByRole("button", { name: "Simpan deal" })).toHaveProperty("disabled", false);

    await user.click(screen.getByRole("button", { name: "Simpan deal" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Deal disimpan");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls(fetchMock)).toEqual(["POST /api/deals", "POST /api/deals"]);
    expect(keyOf(fetchMock, 0)).toMatch(/^[A-Za-z0-9-]{16,100}$/);
    expect(keyOf(fetchMock, 1)).toBe(keyOf(fetchMock, 0));
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
  });

  it("a deal changed after an unknown outcome is a new submission, with a new key", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(jsonResponse(201, { deal: created }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen />);

    const field = await fillAndSave(user);
    await screen.findByRole("alert");
    await user.type(field("Scope pekerjaan"), " + 1 story");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));

    await screen.findByRole("status");
    expect(keyOf(fetchMock, 1)).not.toBe(keyOf(fetchMock, 0));
  });

  it("after a definite refusal, the same deal sent again gets a new key", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(429, { error: "x" })).mockResolvedValueOnce(jsonResponse(201, { deal: created }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen />);

    await fillAndSave(user);
    expect((await screen.findByRole("alert")).textContent).toBe("Belum tersimpan karena terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));

    await screen.findByRole("status");
    expect(keyOf(fetchMock, 1)).not.toBe(keyOf(fetchMock, 0));
  });

  it.each([
    [401, "Belum tersimpan karena sesi kamu sudah berakhir. Muat ulang halaman untuk masuk lagi."],
    [403, "Belum tersimpan karena permintaan ditolak demi keamanan. Muat ulang halaman, lalu coba lagi."],
  ])("a create refused with %i says what to do next, and the server's own text is not shown", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(status, { error: "raw server text" })));
    const user = userEvent.setup();
    render(<DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen />);

    await fillAndSave(user);
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(document.body.textContent).not.toContain("raw server text");
  });

  it("a stage move with no answer that the server did store keeps the card moved, with no error", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { deal: { ...dealFixture, status: "NEGO" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Lanjut ke Nego" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(calls(fetchMock)).toEqual(["PATCH /api/deals/deal-1", "GET /api/deals/deal-1"]);
    await vi.waitFor(() => expect(screen.getAllByRole("region", { name: "Nego" })[0].textContent).toContain("Acme"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a stage move with no answer that was not stored moves back and says it may not be saved", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { deal: dealFixture })));
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Lanjut ke Nego" }));

    expect((await screen.findByRole("alert")).textContent).toContain("belum pasti tersimpan");
    expect(screen.getAllByRole("region", { name: "Masuk" })[0].textContent).toContain("Acme");
  });

  it("an invoice create with no answer says so, and Buat invoice again resends it with the same key and shows the stored invoice", async () => {
    const invoiceDeal = { ...dealFixture, status: "INVOICE" as const };
    const invoice = { id: "inv-1", userId: "user-1", dealId: "deal-1", number: "INV/1", subtotalIdr: 1500000, withholdingTaxType: "NONE", status: "DRAFT", dueDate: null, createdAt: new Date(), updatedAt: new Date() };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { invoice }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[invoiceDeal]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Buat invoice" }));
    expect((await screen.findByRole("alert")).textContent).toContain("invoice ini belum pasti dibuat");
    expect(screen.queryByRole("status")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Buat invoice" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Invoice dibuat");
    expect(calls(fetchMock)).toEqual(["POST /api/invoices", "POST /api/invoices"]);
    expect(keyOf(fetchMock, 1)).toBe(keyOf(fetchMock, 0));
    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    expect(screen.queryByRole("menuitem", { name: "Buat invoice" })).toBeNull();
  });
});

// #55: Ubah deal from the card's menu.
describe("DealClient edit from the board card (#55)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("edits a deal from its card menu: the card shows the saved values, at the same stage", async () => {
    const stored = { ...dealFixture, brand: "Acme Baru", feeIdr: 2_000_000 };
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ deal: stored }) }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DealClient initialDeals={[dealFixture]} initialInvoices={[]} initialDialogOpen={false} />);

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Acme" }));
    await user.click(screen.getByRole("menuitem", { name: "Ubah deal" }));
    const dialog = screen.getByRole("dialog", { name: "Ubah deal" });
    expect(dialog).toBeTruthy();
    await user.clear(screen.getByLabelText("Nama brand"));
    await user.type(screen.getByLabelText("Nama brand"), "Acme Baru");
    await user.clear(screen.getByLabelText(/^Fee \(Rp\)/));
    await user.type(screen.getByLabelText(/^Fee \(Rp\)/), "2000000");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    expect(await screen.findByText("Perubahan deal disimpan.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    const card = screen.getByRole("heading", { name: "Acme Baru" }).closest("article")!;
    expect(card.textContent).toMatch(/Rp\s2\.000\.000/);
    const masuk = screen.getByRole("region", { name: /Masuk/ });
    expect(masuk.textContent).toContain("Acme Baru");
  });
});
