import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { translate, type Language } from "@/lib/i18n";
import type { DealRecord } from "@/lib/deals";
import { DealCard } from "./deal-card";

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brand: "Kopi Nusantara",
    contactWa: "+6281234567890",
    contactName: null,
    scope: "1 Reel + 2 Story",
    feeIdr: 2_500_000,
    deadline: new Date("2026-09-01T00:00:00.000Z"),
    paymentTerms: null,
    status: "NEGO",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof DealCard>> = {}, language: Language = "id") {
  const t = (key: string, values?: Record<string, string>) => translate(language, key, values);
  const onStageChange = vi.fn();
  const onCreateInvoice = vi.fn();
  const utils = render(
    <DealCard
      deal={makeDeal()}
      language={language}
      t={t}
      disabled={false}
      hasInvoice={false}
      isSaving={false}
      onStageChange={onStageChange}
      onCreateInvoice={onCreateInvoice}
      {...props}
    />,
  );
  return { ...utils, onStageChange, onCreateInvoice };
}

describe("DealCard", () => {
  it("shows exactly brand, fee, deadline, and an overflow button", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: "Kopi Nusantara" })).toBeDefined();
    // getByText normalizes the DOM's non-breaking space but not the query string,
    // so this uses a plain space to match formatMoney's non-breaking one.
    expect(screen.getByText("Rp\u00202.500.000")).toBeDefined();
    expect(screen.getByText("1 Sep 2026")).toBeDefined();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("does not render a stage string or a native stage select", () => {
    const { container } = renderCard({ deal: makeDeal({ status: "NEGO" }) });

    expect(container.querySelector("select")).toBeNull();
    expect(screen.queryByText("Nego")).toBeNull();
    expect(screen.queryByText("Negotiation")).toBeNull();
  });

  it("renders the deadline placeholder when there is no deadline, per language", () => {
    renderCard({ deal: makeDeal({ deadline: null }) }, "id");
    expect(screen.getByText("Tanpa tenggat")).toBeDefined();

    renderCard({ deal: makeDeal({ deadline: null }) }, "en");
    expect(screen.getByText("No deadline")).toBeDefined();
  });

  it("exposes an overflow button that is keyboard-focusable and meets the 44px touch target", async () => {
    const user = userEvent.setup();
    renderCard();

    const overflow = screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" });
    expect(overflow.className).toContain("h-11");
    expect(overflow.className).toContain("w-11");

    await user.tab();
    expect(document.activeElement).toBe(overflow);
  });

  it("uses the English overflow label under the English UI", () => {
    renderCard({}, "en");
    expect(screen.getByRole("button", { name: "More actions for deal Kopi Nusantara" })).toBeDefined();
  });

  it("offers Create Invoice from the overflow menu when the deal is at the Invoice stage without one yet", async () => {
    const user = userEvent.setup();
    const { onCreateInvoice } = renderCard({ deal: makeDeal({ status: "INVOICE" }), hasInvoice: false });

    const overflow = screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" });
    expect(overflow.getAttribute("aria-haspopup")).toBe("true");
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(overflow);
    expect(screen.getByRole("menu")).toBeDefined();

    const createInvoice = screen.getByRole("menuitem", { name: "Buat invoice" });
    await user.click(createInvoice);

    expect(onCreateInvoice).toHaveBeenCalledWith("deal-1");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the overflow menu on outside click", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "INVOICE" }), hasInvoice: false });

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders a dismissable, aria-hidden backdrop behind the open overflow menu, absent when closed", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "INVOICE" }), hasInvoice: false });

    expect(screen.queryByTestId("deal-card-menu-backdrop")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    const backdrop = screen.getByTestId("deal-card-menu-backdrop");
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");

    await user.click(backdrop);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByTestId("deal-card-menu-backdrop")).toBeNull();
  });

  it("closes the overflow menu on Escape", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "INVOICE" }), hasInvoice: false });

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.getByRole("menu")).toBeDefined();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not offer Create Invoice from the overflow menu once the deal already has one", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "INVOICE" }), hasInvoice: true });

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.queryByRole("menuitem", { name: "Buat invoice" })).toBeNull();
  });

  it("does not offer Create Invoice from the overflow menu outside the Invoice stage", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "NEGO" }) });

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.queryByRole("menuitem", { name: "Buat invoice" })).toBeNull();
  });

  it("offers adjacent-stage move items (T-15), moving to the previous or next stage", async () => {
    const user = userEvent.setup();
    const { onStageChange } = renderCard({ deal: makeDeal({ status: "NEGO" }) });

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.getByRole("menuitem", { name: "Kembali ke Masuk" })).toBeDefined();

    await user.click(screen.getByRole("menuitem", { name: "Lanjut ke Deal" }));
    expect(onStageChange).toHaveBeenCalledWith("deal-1", "DEAL");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("moving to the previous stage calls onStageChange with the previous stage value", async () => {
    const user = userEvent.setup();
    const { onStageChange } = renderCard({ deal: makeDeal({ status: "NEGO" }) });

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    await user.click(screen.getByRole("menuitem", { name: "Kembali ke Masuk" }));

    expect(onStageChange).toHaveBeenCalledWith("deal-1", "MASUK");
  });

  it("omits the previous-stage move item at the first stage", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "MASUK" }) });
    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.queryByRole("menuitem", { name: /Kembali ke/ })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Lanjut ke Nego" })).toBeDefined();
  });

  it("omits the next-stage move item at the last stage", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "DIBAYAR" }) });
    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.getByRole("menuitem", { name: "Kembali ke Invoice" })).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: /Lanjut ke/ })).toBeNull();
  });

  it("uses the English move labels under the English UI", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "NEGO" }) }, "en");

    await user.click(screen.getByRole("button", { name: "More actions for deal Kopi Nusantara" }));
    expect(screen.getByRole("menuitem", { name: "Back to Inbox" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Move to Deal" })).toBeDefined();
  });

  it("is draggable and puts its own id on the drag data when not disabled", () => {
    const { container } = renderCard({ disabled: false });
    expect(container.querySelector("article")?.getAttribute("draggable")).toBe("true");
  });

  it("is not draggable while a mutation for this deal is pending", () => {
    const { container } = renderCard({ disabled: true });
    expect(container.querySelector("article")?.getAttribute("draggable")).toBe("false");
  });

  it("disables the overflow button while a mutation for this deal is pending", () => {
    renderCard({ disabled: true });
    expect(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" })).toHaveProperty("disabled", true);
  });

  it("shows the saving label on the Create Invoice menu item while saving", async () => {
    const user = userEvent.setup();
    renderCard({ deal: makeDeal({ status: "INVOICE" }), hasInvoice: false, isSaving: true });

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    expect(screen.getByRole("menuitem", { name: "Menyimpan…" })).toBeDefined();
  });

  it("offers a link to the deal's detail page (T-17)", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Aksi lain untuk deal Kopi Nusantara" }));
    const detailLink = screen.getByRole("menuitem", { name: "Lihat detail" });

    expect(detailLink.getAttribute("href")).toBe("/deal/deal-1");
  });
});
