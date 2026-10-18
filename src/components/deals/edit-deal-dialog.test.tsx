import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { translate } from "@/lib/i18n";
import type { DealRecord } from "@/lib/deals";
import { EditDealDialog } from "./edit-deal-dialog";

const t = (key: string, values?: Record<string, string>) => translate("id", key, values);

const deal: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Kopi Nusantara",
  contactWa: "6281234567890",
  contactName: "Budi",
  scope: "1 Reel + 2 Story",
  feeIdr: 2_500_000,
  deadline: new Date("2026-11-30T00:00:00.000Z"),
  paymentTerms: "30 hari",
  status: "KONTEN",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// PATCH answers `patch`; GET (the read-back) answers `stored`.
function stubFetch(patch: () => Promise<unknown>, stored: unknown) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => (init?.method === "PATCH" ? patch() : Promise.resolve(jsonResponse(200, { deal: stored }))));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function patchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH");
}

function renderDialog(props: Partial<React.ComponentProps<typeof EditDealDialog>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<EditDealDialog open deal={deal} t={t} onClose={onClose} onSaved={onSaved} {...props} />);
  return { onClose, onSaved };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("EditDealDialog (#55)", () => {
  it("opens as a labelled dialog prefilled with the saved deal", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Ubah deal" })).toBeTruthy();
    expect(screen.getByLabelText("Nama brand")).toHaveProperty("value", "Kopi Nusantara");
    expect(screen.getByLabelText("Kontak WhatsApp")).toHaveProperty("value", "6281234567890");
    expect(screen.getByLabelText("Nama kontak (opsional)")).toHaveProperty("value", "Budi");
    expect(screen.getByLabelText("Scope pekerjaan")).toHaveProperty("value", "1 Reel + 2 Story");
    expect(screen.getByLabelText(/^Fee \(Rp\)/)).toHaveProperty("value", "2500000");
    expect(screen.getByLabelText("Tenggat")).toHaveProperty("value", "2026-11-30");
    expect(screen.getByLabelText("Syarat pembayaran (opsional)")).toHaveProperty("value", "30 hari");
    expect(screen.getByRole("button", { name: "Simpan perubahan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Batal" })).toBeTruthy();
  });

  it("renders nothing while closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Batal with nothing changed just closes, sending nothing", async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200, {})), deal);
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks before discarding unsaved changes, from Batal, Escape and the close button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.type(screen.getByLabelText("Nama brand"), " Baru");

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.getByRole("alertdialog", { name: "Buang perubahan yang belum disimpan?" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lanjut mengubah" }));
    await user.click(screen.getByRole("button", { name: "Lanjut mengubah" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText("Nama brand")).toHaveProperty("value", "Kopi Nusantara Baru");

    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tutup" }));
    await user.click(screen.getByRole("button", { name: "Buang perubahan" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("while the discard question is open, the form is not in the tab order: Tab stays on the question and the close button", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText("Nama brand"), " Baru");
    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(screen.queryByLabelText("Nama brand")).toBeNull();
    expect(screen.queryByRole("button", { name: "Simpan perubahan" })).toBeNull();
    const reachable = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      reachable.add((document.activeElement as HTMLElement).textContent ?? "");
    }
    expect([...reachable].sort()).toEqual(["Buang perubahan", "Lanjut mengubah", "×"].sort());

    // Keeping on editing brings the form back with the edit.
    await user.click(screen.getByRole("button", { name: "Lanjut mengubah" }));
    expect(screen.getByLabelText("Nama brand")).toHaveProperty("value", "Kopi Nusantara Baru");
  });

  it("saves only the changed fields, without a status, and reports the deal read back from the server", async () => {
    const stored = { ...deal, brand: "Kopi Baru", feeIdr: 3_000_000 };
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200, { deal: stored })), stored);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.clear(screen.getByLabelText("Nama brand"));
    await user.type(screen.getByLabelText("Nama brand"), "Kopi Baru");
    await user.clear(screen.getByLabelText(/^Fee \(Rp\)/));
    await user.type(screen.getByLabelText(/^Fee \(Rp\)/), "3000000");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(stored));
    const [[url, init]] = patchCalls(fetchMock);
    expect(url).toBe("/api/deals/deal-1");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ brand: "Kopi Baru", feeIdr: 3_000_000 });
    expect(fetchMock.mock.calls.at(-1)?.[1]).toEqual({ cache: "no-store", signal: expect.anything() });
  });

  it("clears emptied optional fields with null (FIND-11)", async () => {
    const stored = { ...deal, contactName: null, paymentTerms: null, deadline: null };
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200, { deal: stored })), stored);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.clear(screen.getByLabelText("Nama kontak (opsional)"));
    await user.clear(screen.getByLabelText("Syarat pembayaran (opsional)"));
    await user.clear(screen.getByLabelText("Tenggat"));
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse((patchCalls(fetchMock)[0][1] as RequestInit).body as string)).toEqual({ contactName: null, paymentTerms: null, deadline: null });
  });

  it("refuses an invalid WhatsApp number in the browser, marks the field and sends nothing", async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200, {})), deal);
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Kontak WhatsApp"));
    await user.type(screen.getByLabelText("Kontak WhatsApp"), "12345");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    expect(screen.getByText("Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.")).toBeTruthy();
    expect(screen.getByLabelText("Kontak WhatsApp").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Kontak WhatsApp"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the fields a 400 from the server names, keeping every edit", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(400, { error: "x", fields: { scope: ["too long"] } })), deal);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText("Scope pekerjaan"), " tambahan");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    expect(await screen.findByText("Periksa kembali isian yang ditandai.")).toBeTruthy();
    expect(screen.getByLabelText("Scope pekerjaan").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Scope pekerjaan")).toHaveProperty("value", "1 Reel + 2 Story tambahan");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each([
    [401, "Belum tersimpan karena sesi kamu sudah berakhir. Muat ulang halaman untuk masuk lagi."],
    [404, "Deal ini tidak ditemukan lagi. Muat ulang halaman."],
    [409, "Perubahan deal belum bisa disimpan. Coba lagi."],
  ])("a %i says what happened, keeps the dialog and the edits, and reports no success", async (status, text) => {
    stubFetch(() => Promise.resolve(jsonResponse(status, { error: "x" })), deal);
    const user = userEvent.setup();
    const { onSaved, onClose } = renderDialog();

    await user.type(screen.getByLabelText("Nama brand"), " Baru");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    expect((await screen.findByRole("alert")).textContent).toBe(text);
    expect(screen.getByLabelText("Nama brand")).toHaveProperty("value", "Kopi Nusantara Baru");
    expect(screen.getByRole("button", { name: "Simpan perubahan" })).toHaveProperty("disabled", false);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a save with no answer counts once the server's copy shows it", async () => {
    const stored = { ...deal, brand: "Kopi Nusantara Baru" };
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")), stored);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText("Nama brand"), " Baru");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(stored));
  });

  it("a save with no answer that the server's copy does not show is reported as uncertain, not as saved", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(503, {})), deal);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText("Nama brand"), " Baru");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/belum pasti tersimpan/);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("a 200 whose change is not in the server's copy is not reported as saved", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(200, { deal: { ...deal, brand: "Kopi Nusantara Baru" } })), deal);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText("Nama brand"), " Baru");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/Belum bisa dipastikan/);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("sends one PATCH however often Simpan is pressed while saving", async () => {
    let resolvePatch: (value: unknown) => void = () => {};
    const stored = { ...deal, brand: "Kopi Nusantara Baru" };
    const fetchMock = stubFetch(() => new Promise((resolve) => (resolvePatch = resolve)), stored);
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.type(screen.getByLabelText("Nama brand"), " Baru");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(screen.getByRole("button", { name: "Menyimpan…" })).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("button", { name: "Menyimpan…" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();

    resolvePatch(jsonResponse(200, { deal: stored }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(patchCalls(fetchMock)).toHaveLength(1);
  });

  it("says the invoice is not changed when the deal has one", () => {
    renderDialog({ invoiceNumber: "INV/2026/10/001" });

    expect(screen.getByRole("note").textContent).toContain("Deal ini sudah punya invoice INV/2026/10/001. Mengubah deal tidak mengubah jumlah, nomor, PPh, atau jatuh tempo invoice itu.");
  });
});
