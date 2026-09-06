import { describe, expect, it } from "vitest";
import { decryptShareToken, encryptShareToken } from "./share-token-crypto";

const SECRET = "test-only-secret-do-not-use-in-any-real-environment";

describe("encryptShareToken / decryptShareToken", () => {
  it("round-trips an arbitrary token through encryption and decryption", () => {
    const token = "a-real-looking-base64url-token_ABC123";

    const encrypted = encryptShareToken(token, SECRET);

    expect(encrypted).not.toBe(token);
    expect(encrypted).not.toContain(token);
    expect(decryptShareToken(encrypted, SECRET)).toBe(token);
  });

  it("produces a different ciphertext each time for the same token (random IV)", () => {
    const token = "same-token-every-time";

    const first = encryptShareToken(token, SECRET);
    const second = encryptShareToken(token, SECRET);

    expect(first).not.toBe(second);
    expect(decryptShareToken(first, SECRET)).toBe(token);
    expect(decryptShareToken(second, SECRET)).toBe(token);
  });

  it("fails to decrypt with the wrong secret rather than returning garbage", () => {
    const encrypted = encryptShareToken("some-token", SECRET);

    expect(decryptShareToken(encrypted, "a-completely-different-secret")).toBeNull();
  });

  it("fails to decrypt a tampered ciphertext (authentication tag catches it)", () => {
    const encrypted = encryptShareToken("some-token", SECRET);
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    const ciphertextBytes = Buffer.from(ciphertext, "base64");
    ciphertextBytes[0] ^= 0xff; // flip every bit of the first byte
    const tampered = [version, iv, tag, ciphertextBytes.toString("base64")].join(".");

    expect(decryptShareToken(tampered, SECRET)).toBeNull();
  });

  it("returns null for malformed/foreign input instead of throwing", () => {
    expect(decryptShareToken("not-the-right-shape", SECRET)).toBeNull();
    expect(decryptShareToken("", SECRET)).toBeNull();
    expect(decryptShareToken("v2.a.b.c", SECRET)).toBeNull();
  });

  it("throws a clear error when AUTH_SECRET is missing and no secret is passed explicitly", () => {
    const original = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      expect(() => encryptShareToken("token")).toThrow(/AUTH_SECRET/);
      expect(() => decryptShareToken("v1.a.b.c")).toThrow(/AUTH_SECRET/);
    } finally {
      if (original !== undefined) process.env.AUTH_SECRET = original;
    }
  });
});
