import { describe, expect, it } from "vitest";
import { dealInputSchema } from "./deal-validation";

describe("dealInputSchema", () => {
  it("accepts the minimum deal capture fields", () => {
    const result = dealInputSchema.parse({
      brand: "Kopi Nusantara",
      contactWa: "6281212345678",
      scope: "3 video TikTok + 2 story",
      feeIdr: 1500000,
      deadline: "2026-08-01",
      paymentTerms: "30 hari setelah tayang",
      status: "MASUK",
    });

    expect(result.brand).toBe("Kopi Nusantara");
    expect(result.feeIdr).toBe(1500000);
    expect(result.status).toBe("MASUK");
  });

  it("rejects a negative fee and unknown pipeline status", () => {
    const result = dealInputSchema.safeParse({
      brand: "Kopi Nusantara",
      contactWa: "6281212345678",
      scope: "3 video TikTok",
      feeIdr: -1,
      status: "RANDOM",
    });

    expect(result.success).toBe(false);
  });

  it("allows optional deadline and payment terms", () => {
    const result = dealInputSchema.parse({
      brand: "Brand Baru",
      contactWa: "628123456789",
      scope: "Satu video",
      feeIdr: 500000,
    });

    expect(result.deadline).toBeUndefined();
    expect(result.paymentTerms).toBeUndefined();
    expect(result.status).toBe("MASUK");
  });
});
