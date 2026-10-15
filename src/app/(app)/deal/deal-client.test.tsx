import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import type { DealRecord } from "@/lib/deals";
import { DEAL_DRAG_MIME } from "@/components/deals/deal-card";
import DealClient, { describeSaveFailure } from "./deal-client";

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

  it("rolls back to the prior stage and shows an error when the move request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(500, {}))));

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

describe("DealClient save failure detail (issue #50)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function submitAndReadAlert(fetchImpl: () => Promise<unknown>) {
    vi.stubGlobal("fetch", vi.fn(fetchImpl));
    render(<DealClient initialDeals={[]} initialInvoices={[]} initialDialogOpen />);
    const dialog = screen.getByRole("dialog", { name: "Tambah deal" });
    fireEvent.submit(dialog.querySelector("form")!);
    return (await screen.findByRole("alert")).textContent;
  }

  it("shows the server's code, the rejected fields and the log reference under the generic message", async () => {
    const text = await submitAndReadAlert(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: async () => ({ error: "Periksa kembali data deal kamu.", fields: { contactWa: ["x"], feeIdr: ["y"] }, code: "INVALID_INPUT", ref: "ab12cd34" }),
      }),
    );
    expect(text).toBe("Deal belum bisa disimpan.Kode: INVALID_INPUT · contactWa, feeIdr · ab12cd34");
  });

  it("says NETWORK when the request never got a response", async () => {
    const text = await submitAndReadAlert(() => Promise.reject(new TypeError("Load failed")));
    expect(text).toBe("Deal belum bisa disimpan.Kode: NETWORK");
  });

  it("gives the HTTP status when the response is not the API's JSON (an SSO or login page, say)", async () => {
    const text = await submitAndReadAlert(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }),
    );
    expect(text).toBe("Deal belum bisa disimpan.Kode: NON_JSON · HTTP 200");
  });
});

describe("describeSaveFailure", () => {
  it("falls back to the HTTP status when the JSON carries no code", () => {
    expect(describeSaveFailure(502, { message: "Bad gateway" })).toBe("HTTP 502");
  });
});
