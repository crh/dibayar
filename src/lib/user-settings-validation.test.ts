import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE_CHASE,
  DEFAULT_TEMPLATE_SEND,
  userSettingsInputSchema,
} from "./user-settings-validation";

const minimalValid = {
  issuerName: "Kenji Creator",
  bankName: "Bank Central",
  bankAccountNumber: "1234567890",
  bankAccountHolder: "Kenji Creator",
};

describe("userSettingsInputSchema", () => {
  it("accepts the minimum required fields with all optionals absent", () => {
    const result = userSettingsInputSchema.parse(minimalValid);

    expect(result.issuerName).toBe("Kenji Creator");
    expect(result.issuerAddress).toBeUndefined();
    expect(result.issuerWhatsapp).toBeUndefined();
    expect(result.issuerEmail).toBeUndefined();
    expect(result.templateSend).toBeUndefined();
    expect(result.templateChase).toBeUndefined();
  });

  it("rejects a missing issuerName", () => {
    const result = userSettingsInputSchema.safeParse({ ...minimalValid, issuerName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing bank fields", () => {
    expect(userSettingsInputSchema.safeParse({ ...minimalValid, bankName: "" }).success).toBe(false);
    expect(userSettingsInputSchema.safeParse({ ...minimalValid, bankAccountNumber: "" }).success).toBe(false);
    expect(userSettingsInputSchema.safeParse({ ...minimalValid, bankAccountHolder: "" }).success).toBe(false);
  });

  it("treats whitespace-only optional fields as unset, not stored blanks", () => {
    const result = userSettingsInputSchema.parse({
      ...minimalValid,
      issuerAddress: "   ",
      templateSend: "\n\t",
    });

    expect(result.issuerAddress).toBeUndefined();
    expect(result.templateSend).toBeUndefined();
  });

  it("rejects an invalid issuer email but allows an empty one", () => {
    expect(userSettingsInputSchema.safeParse({ ...minimalValid, issuerEmail: "not-an-email" }).success).toBe(false);
    expect(userSettingsInputSchema.safeParse({ ...minimalValid, issuerEmail: "" }).success).toBe(true);
    expect(userSettingsInputSchema.parse({ ...minimalValid, issuerEmail: "a@b.com" }).issuerEmail).toBe("a@b.com");
  });

  it("has no tax, NPWP, or registration fields", () => {
    const parsed = userSettingsInputSchema.safeParse({
      ...minimalValid,
      npwp: "01.234.567.8-901.000",
      taxId: "irrelevant",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && "npwp" in parsed.data).toBe(false);
  });

  it("keeps custom template text as provided", () => {
    const result = userSettingsInputSchema.parse({
      ...minimalValid,
      templateSend: "Custom send template {tautan}",
      templateChase: "Custom chase template {tautan}",
    });

    expect(result.templateSend).toBe("Custom send template {tautan}");
    expect(result.templateChase).toBe("Custom chase template {tautan}");
  });

  it("exposes the exact spec default template text", () => {
    expect(DEFAULT_TEMPLATE_SEND).toBe(
      "Halo {brand}, berikut invoice {nomor_invoice} sebesar {jumlah}.\n" +
        "Jatuh tempo {jatuh_tempo}.\n" +
        "Detail dan unduh PDF: {tautan}\n" +
        "Terima kasih!",
    );
    expect(DEFAULT_TEMPLATE_CHASE).toBe(
      "Halo {brand}, izin mengingatkan invoice {nomor_invoice} sebesar {jumlah} yang jatuh tempo {jatuh_tempo}.\n" +
        "Mohon dibantu prosesnya ya. Detail: {tautan}\n" +
        "Terima kasih!",
    );
  });
});
