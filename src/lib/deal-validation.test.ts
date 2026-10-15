import { describe, expect, it } from "vitest";
import { dealInputSchema, dealPatchSchema } from "./deal-validation";

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

  it("accepts an optional contact name (T-17)", () => {
    const withName = dealInputSchema.parse({
      brand: "Brand Baru",
      contactWa: "628123456789",
      contactName: "Budi Santoso",
      scope: "Satu video",
      feeIdr: 500000,
    });
    expect(withName.contactName).toBe("Budi Santoso");

    const withoutName = dealInputSchema.parse({
      brand: "Brand Baru",
      contactWa: "628123456789",
      scope: "Satu video",
      feeIdr: 500000,
    });
    expect(withoutName.contactName).toBeUndefined();
  });
});

describe("dealInputSchema contactWa (#50)", () => {
  const base = { brand: "Kopi Nusantara", scope: "1 reels", feeIdr: 1_000_000 };
  const contactWaOf = (contactWa: string) => dealInputSchema.safeParse({ ...base, contactWa });

  it.each(["0812 3456 7890", "+62 812-3456-7890", "6281234567890", "81234567890", "0812345678"])(
    "accepts %s, a number WhatsApp can open",
    (value) => {
      expect(contactWaOf(value).success).toBe(true);
    },
  );

  // "1" is what the iPhone tester typed; "123456" passed the old 6-character
  // rule and saved a deal WhatsApp could not open.
  it.each(["1", "12345", "123456", "08123", "abcdefgh", "      ", "6281234567890123"])(
    "refuses %s with a WhatsApp message on contactWa alone",
    (value) => {
      const result = contactWaOf(value);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(Object.keys(result.error.flatten().fieldErrors)).toEqual(["contactWa"]);
    },
  );
});

describe("dealPatchSchema", () => {
  // FIND-10: partial() keeps a field's default, so a patch without a status
  // used to come back with status "MASUK" and move the deal there.
  it("adds no status to a patch that does not send one", () => {
    expect(dealPatchSchema.parse({ contactName: "Budi Santoso" })).toEqual({ contactName: "Budi Santoso" });
    expect(dealPatchSchema.parse({ contactWa: "628123456789" })).toEqual({ contactWa: "628123456789" });
    expect(dealPatchSchema.parse({})).toEqual({});
  });

  it("still accepts a status, and still rejects an unknown one", () => {
    expect(dealPatchSchema.parse({ status: "NEGO" })).toEqual({ status: "NEGO" });
    expect(dealPatchSchema.safeParse({ status: "RANDOM" }).success).toBe(false);
  });

  it("keeps every other rule of the create schema", () => {
    expect(dealPatchSchema.safeParse({ contactWa: "12345" }).success).toBe(false);
    expect(dealPatchSchema.safeParse({ contactWa: "123456" }).success).toBe(false);
    expect(dealPatchSchema.safeParse({ brand: "" }).success).toBe(false);
    expect(dealPatchSchema.safeParse({ feeIdr: -1 }).success).toBe(false);
  });
});
