import { describe, expect, it } from "vitest";
import { dealFormErrorsFromServer, EMPTY_DEAL_FORM, validateDealForm } from "./deal-form";

const valid = { ...EMPTY_DEAL_FORM, brand: "Kopi", contactWa: "0812 3456 7890", scope: "1 reels", feeIdr: "1500000" };

describe("validateDealForm", () => {
  it("passes a form the server accepts", () => {
    expect(validateDealForm(valid)).toEqual({});
  });

  // #50: one digit passed the browser's `required` and came back from the
  // server as a bare "could not be saved".
  it.each(["1", "123456", "abc", "   "])("marks WhatsApp %j with its own message", (contactWa) => {
    expect(validateDealForm({ ...valid, contactWa })).toEqual({ contactWa: "dealForm.error.contactWa" });
  });

  it("marks brand and scope that are only spaces", () => {
    expect(validateDealForm({ ...valid, brand: "  ", scope: "\n" })).toEqual({
      brand: "dealForm.error.brand",
      scope: "dealForm.error.scope",
    });
  });

  it.each(["", "1.5", "-1", "10000000001"])("marks fee %j", (feeIdr) => {
    expect(validateDealForm({ ...valid, feeIdr })).toEqual({ feeIdr: "dealForm.error.feeIdr" });
  });
});

describe("dealFormErrorsFromServer", () => {
  it("maps the fields a 400 names to the form's messages and ignores names the form lacks", () => {
    expect(dealFormErrorsFromServer({ contactName: ["x"], paymentTerms: ["y"], status: ["z"] })).toEqual({
      contactName: "dealForm.error.contactName",
      paymentTerms: "dealForm.error.paymentTerms",
    });
  });

  it("returns nothing for a missing or malformed list", () => {
    expect(dealFormErrorsFromServer(undefined)).toEqual({});
    expect(dealFormErrorsFromServer("brand")).toEqual({});
  });
});
