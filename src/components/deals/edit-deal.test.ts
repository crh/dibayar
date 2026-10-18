import { describe, expect, it } from "vitest";
import type { DealRecord } from "@/lib/deals";
import { buildDealPatch, dealHoldsPatch, dealToForm, toDateInputValue } from "./edit-deal";

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

describe("dealToForm", () => {
  it("prefills every editable field from the saved deal", () => {
    expect(dealToForm(deal)).toEqual({
      brand: "Kopi Nusantara",
      contactWa: "6281234567890",
      contactName: "Budi",
      scope: "1 Reel + 2 Story",
      feeIdr: "2500000",
      deadline: "2026-11-30",
      paymentTerms: "30 hari",
    });
  });

  it("shows empty fields for a deal without the optional values", () => {
    expect(dealToForm({ ...deal, contactName: null, paymentTerms: null, deadline: null })).toMatchObject({ contactName: "", paymentTerms: "", deadline: "" });
  });

  it("reads a deadline that arrived as JSON text", () => {
    expect(toDateInputValue("2026-11-30T00:00:00.000Z")).toBe("2026-11-30");
    expect(toDateInputValue("not a date")).toBe("");
  });
});

describe("buildDealPatch", () => {
  const initial = dealToForm(deal);

  it("is empty when nothing changed", () => {
    expect(buildDealPatch(initial, { ...initial })).toEqual({});
  });

  it("sends only the changed fields, the fee as a number, and never a status", () => {
    const patch = buildDealPatch(initial, { ...initial, brand: "Kopi Baru", feeIdr: "3000000" });
    expect(patch).toEqual({ brand: "Kopi Baru", feeIdr: 3_000_000 });
    expect(patch).not.toHaveProperty("status");
  });

  it("sends null for an emptied optional field, so it is cleared rather than left alone (FIND-11)", () => {
    expect(buildDealPatch(initial, { ...initial, contactName: "", paymentTerms: "  ", deadline: "" })).toEqual({ contactName: null, paymentTerms: null, deadline: null });
  });

  it("sends a new deadline as the picked day", () => {
    expect(buildDealPatch(initial, { ...initial, deadline: "2026-12-15" })).toEqual({ deadline: "2026-12-15" });
  });
});

describe("dealHoldsPatch", () => {
  it("accepts the server's normalized copy of the change", () => {
    const patch = { brand: " Kopi Baru ", contactWa: "0812-3456-7891", contactName: null, deadline: "2026-12-15", feeIdr: 3_000_000 };
    const stored = { ...deal, brand: "Kopi Baru", contactWa: "6281234567891", contactName: null, deadline: new Date("2026-12-15T00:00:00.000Z"), feeIdr: 3_000_000 };
    expect(dealHoldsPatch(stored, patch)).toBe(true);
  });

  it("rejects a copy that still has the old value of any changed field", () => {
    expect(dealHoldsPatch(deal, { contactName: null })).toBe(false);
    expect(dealHoldsPatch(deal, { feeIdr: 1 })).toBe(false);
    expect(dealHoldsPatch(deal, { deadline: null })).toBe(false);
    expect(dealHoldsPatch(deal, { paymentTerms: "Lunas" })).toBe(false);
  });

  it("ignores fields the patch did not touch", () => {
    expect(dealHoldsPatch({ ...deal, scope: "something else" }, { brand: "Kopi Nusantara" })).toBe(true);
  });
});
