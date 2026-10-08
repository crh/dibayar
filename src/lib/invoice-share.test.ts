import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  createOrRegenerateShare,
  ensureShare,
  generateShareToken,
  getPublicInvoiceDocumentByToken,
  getShareState,
  hashShareToken,
  revokeShare,
  type InvoiceShareDb,
  type InvoiceShareRecord,
  type PublicInvoiceDocumentLookupDb,
} from "./invoice-share";
import { decryptShareToken, encryptShareToken } from "./share-token-crypto";
import type { InvoiceRecord } from "./invoices";

const TEST_AUTH_SECRET = "test-only-secret-do-not-use-in-any-real-environment";

beforeEach(() => {
  process.env.AUTH_SECRET = TEST_AUTH_SECRET;
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

const ownedInvoice: InvoiceRecord = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "PPH23",
  status: "SENT",
  dueDate: new Date("2026-07-31T00:00:00.000Z"),
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T00:00:00.000Z"),
};

const existingShare: InvoiceShareRecord = {
  id: "share-1",
  invoiceId: "invoice-1",
  tokenHash: "existing-hash",
  tokenCiphertext: null,
  expiresAt: new Date("2026-10-14T00:00:00.000Z"),
  createdAt: new Date("2026-07-16T00:00:00.000Z"),
  updatedAt: new Date("2026-07-16T00:00:00.000Z"),
};

function makeDb(options: {
  invoice?: InvoiceRecord | null;
  share?: InvoiceShareRecord | null;
  upsertImpl?: (args: unknown) => Promise<InvoiceShareRecord>;
}) {
  const { invoice = ownedInvoice, share = null, upsertImpl } = options;

  const invoiceFindFirst = vi.fn(async () => invoice);
  const shareFindUnique = vi.fn(async () => share);
  const shareUpsert = vi.fn(
    upsertImpl ??
      (async ({ create }: { create: { invoiceId: string; tokenHash: string; tokenCiphertext?: string } }) => ({
        id: "share-new",
        invoiceId: create.invoiceId,
        tokenHash: create.tokenHash,
        tokenCiphertext: create.tokenCiphertext ?? null,
        expiresAt: null,
        createdAt: new Date("2026-07-17T00:00:00.000Z"),
        updatedAt: new Date("2026-07-17T00:00:00.000Z"),
      })),
  );
  const shareDeleteMany = vi.fn(async () => ({ count: share ? 1 : 0 }));

  const db = {
    invoice: { findFirst: invoiceFindFirst, findMany: vi.fn() },
    invoiceShare: {
      findUnique: shareFindUnique,
      upsert: shareUpsert,
      deleteMany: shareDeleteMany,
    },
  } as unknown as InvoiceShareDb;

  return { db, invoiceFindFirst, shareFindUnique, shareUpsert, shareDeleteMany };
}

describe("generateShareToken", () => {
  it("returns a base64url encoding of exactly 32 random bytes", () => {
    const token = generateShareToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url").length).toBe(32);
  });

  it("never repeats across many calls (entropy sanity check)", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateShareToken()));

    expect(tokens.size).toBe(200);
  });
});

describe("hashShareToken", () => {
  it("returns the SHA-256 hex digest of the token", () => {
    const token = "sample-token-value";
    const expected = createHash("sha256").update(token).digest("hex");

    expect(hashShareToken(token)).toBe(expected);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashShareToken("token-a")).not.toBe(hashShareToken("token-b"));
  });
});

describe("getShareState", () => {
  // Before existingShare's expiry (2026-10-14), so these don't depend on today's date.
  const now = new Date("2026-08-01T00:00:00.000Z");

  it("returns not-found for an invoice not owned by the requesting user", async () => {
    const { db, shareFindUnique } = makeDb({ invoice: null });

    const result = await getShareState(db, "invoice-1", "user-2", now);

    expect(result).toEqual({ kind: "not-found" });
    expect(shareFindUnique).not.toHaveBeenCalled();
  });

  it("reports inactive when no share row exists", async () => {
    const { db } = makeDb({ share: null });

    const result = await getShareState(db, "invoice-1", "user-1", now);

    expect(result).toEqual({ kind: "state", status: "inactive" });
  });

  it("reports active with a null path (not an error) for a share created before encryption existed", async () => {
    const { db } = makeDb({ share: existingShare });

    const result = await getShareState(db, "invoice-1", "user-1", now);

    expect(result).toEqual({ kind: "state", status: "active", path: null, expiresAt: existingShare.expiresAt });
    expect(JSON.stringify(result)).not.toContain("existing-hash");
  });

  it("recovers the owner's own active link by decrypting the stored ciphertext (reuse across reload/new session)", async () => {
    const realToken = "token-the-owner-already-shared-with-a-brand";
    const share: InvoiceShareRecord = {
      ...existingShare,
      tokenCiphertext: encryptShareToken(realToken),
    };
    const { db } = makeDb({ share });

    const result = await getShareState(db, "invoice-1", "user-1", now);

    expect(result).toEqual({
      kind: "state",
      status: "active",
      path: `/i/${realToken}`,
      expiresAt: existingShare.expiresAt,
    });
    // Never leaks the raw ciphertext or hash alongside the recovered path.
    expect(JSON.stringify(result)).not.toContain("existing-hash");
    expect(JSON.stringify(result)).not.toContain(share.tokenCiphertext);
  });

  it("reports active with a null path (not an error or a crash) when the ciphertext is corrupted", async () => {
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: "not-a-real-ciphertext" };
    const { db } = makeDb({ share });

    const result = await getShareState(db, "invoice-1", "user-1", now);

    expect(result).toEqual({ kind: "state", status: "active", path: null, expiresAt: existingShare.expiresAt });
  });

  it("reports active with a null path when AUTH_SECRET rotated since the ciphertext was written", async () => {
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken("a-token") };
    process.env.AUTH_SECRET = "a-different-secret-than-when-this-was-encrypted";
    const { db } = makeDb({ share });

    const result = await getShareState(db, "invoice-1", "user-1", now);

    expect(result).toEqual({ kind: "state", status: "active", path: null, expiresAt: existingShare.expiresAt });
  });

  it("reports a recoverable share with no expiry as active (it never expires)", async () => {
    const token = "legacy-no-expiry-token";
    const { db } = makeDb({ share: { ...existingShare, tokenCiphertext: encryptShareToken(token), expiresAt: null } });

    const result = await getShareState(db, "invoice-1", "user-1", now);

    expect(result).toEqual({ kind: "state", status: "active", path: `/i/${token}`, expiresAt: null });
  });

  // FIND-07: an expired row used to be reported as active with its past
  // expiry, so invoice detail showed and sent a dead link.
  it("reports an expired share as expired, not active, and never returns its path", async () => {
    const token = "expired-token-must-not-reach-the-owner-ui";
    const expiresAt = new Date("2020-01-01T00:00:00.000Z");
    const { db } = makeDb({ share: { ...existingShare, tokenCiphertext: encryptShareToken(token), expiresAt } });

    const result = await getShareState(db, "invoice-1", "user-1", now);

    expect(result).toEqual({ kind: "state", status: "expired", expiresAt });
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("treats a share expiring exactly now as expired, and one a millisecond later as active", async () => {
    const tokenCiphertext = encryptShareToken("edge-token");
    const atNow = makeDb({ share: { ...existingShare, tokenCiphertext, expiresAt: now } });
    const justAfter = makeDb({ share: { ...existingShare, tokenCiphertext, expiresAt: new Date(now.getTime() + 1) } });

    expect(await getShareState(atNow.db, "invoice-1", "user-1", now)).toEqual({ kind: "state", status: "expired", expiresAt: now });
    expect((await getShareState(justAfter.db, "invoice-1", "user-1", now)).kind === "state").toBe(true);
    expect(await getShareState(justAfter.db, "invoice-1", "user-1", now)).toMatchObject({ status: "active", path: "/i/edge-token" });
  });

  it("reports an expired share as expired even when its path is unrecoverable", async () => {
    const expiresAt = new Date("2020-01-01T00:00:00.000Z");
    const { db } = makeDb({ share: { ...existingShare, tokenCiphertext: null, expiresAt } });

    expect(await getShareState(db, "invoice-1", "user-1", now)).toEqual({ kind: "state", status: "expired", expiresAt });
  });

  it("never writes: reading the state of an expired share does not replace or extend it", async () => {
    const { db, shareUpsert, shareDeleteMany } = makeDb({ share: { ...existingShare, expiresAt: new Date("2020-01-01T00:00:00.000Z") } });

    await getShareState(db, "invoice-1", "user-1", now);

    expect(shareUpsert).not.toHaveBeenCalled();
    expect(shareDeleteMany).not.toHaveBeenCalled();
  });
});

describe("createOrRegenerateShare", () => {
  it("returns not-found for an invoice not owned by the requesting user", async () => {
    const { db, shareUpsert } = makeDb({ invoice: null });

    const result = await createOrRegenerateShare(db, "invoice-1", "user-2");

    expect(result).toEqual({ kind: "not-found" });
    expect(shareUpsert).not.toHaveBeenCalled();
  });

  it("stores the hash plus an encrypted (not plaintext) copy of a freshly generated token, and returns the plaintext path once", async () => {
    const injectedToken = "deterministic-test-token-value";
    const now = new Date("2026-07-19T00:00:00.000Z");
    const expectedExpiry = new Date("2026-10-17T00:00:00.000Z");
    const { db, shareUpsert } = makeDb({});

    const result = await createOrRegenerateShare(db, "invoice-1", "user-1", () => injectedToken, () => now);

    expect(result).toEqual({ kind: "created", path: `/i/${injectedToken}`, expiresAt: expectedExpiry });
    expect(shareUpsert).toHaveBeenCalledTimes(1);
    const call = shareUpsert.mock.calls[0][0] as unknown as {
      where: { invoiceId: string };
      create: { invoiceId: string; tokenHash: string; tokenCiphertext: string; expiresAt: Date };
      update: { tokenHash: string; tokenCiphertext: string; expiresAt: Date };
    };
    expect(call.where).toEqual({ invoiceId: "invoice-1" });
    expect(call.create.invoiceId).toBe("invoice-1");
    for (const args of [call.create, call.update]) {
      expect(args.tokenHash).toBe(hashShareToken(injectedToken));
      expect(args.expiresAt).toEqual(expectedExpiry);
      expect(args.tokenCiphertext).not.toBe(injectedToken);
      expect(decryptShareToken(args.tokenCiphertext)).toBe(injectedToken);
    }
  });

  it("resets the 90-day expiry clock when regenerating", async () => {
    const now = new Date("2026-08-01T12:00:00.000Z");
    const { db, shareUpsert } = makeDb({ share: existingShare });

    await createOrRegenerateShare(db, "invoice-1", "user-1", () => "new-token", () => now);

    expect(shareUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ expiresAt: new Date("2026-10-30T12:00:00.000Z") }),
    }));
  });

  it("never passes the plaintext token itself to the database layer", async () => {
    const injectedToken = "plaintext-must-not-be-stored";
    const { db, shareUpsert } = makeDb({});

    await createOrRegenerateShare(db, "invoice-1", "user-1", () => injectedToken);

    const call = shareUpsert.mock.calls[0][0] as unknown as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(Object.values(call.create)).not.toContain(injectedToken);
    expect(Object.values(call.update)).not.toContain(injectedToken);
  });

  it("regenerates in place (upsert) rather than accumulating rows when a share already exists", async () => {
    const { db, shareUpsert } = makeDb({ share: existingShare });

    await createOrRegenerateShare(db, "invoice-1", "user-1", () => "another-token");

    expect(shareUpsert).toHaveBeenCalledTimes(1);
    expect(shareUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { invoiceId: "invoice-1" } }),
    );
  });

  it("regenerating replaces the recoverable link with the new token, not the old one", async () => {
    const oldToken = "the-old-token-that-should-stop-working";
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken(oldToken) };
    const { db, shareUpsert } = makeDb({ share });

    const newToken = "the-new-token-after-regenerate";
    await createOrRegenerateShare(db, "invoice-1", "user-1", () => newToken);

    const call = shareUpsert.mock.calls[0][0] as unknown as { update: { tokenCiphertext: string } };
    expect(decryptShareToken(call.update.tokenCiphertext)).toBe(newToken);
    expect(decryptShareToken(call.update.tokenCiphertext)).not.toBe(oldToken);
  });

  it("rotates even when the existing share is unexpired and recoverable (explicit regenerate is destructive)", async () => {
    const oldToken = "a-perfectly-usable-existing-token";
    const now = new Date("2026-08-01T00:00:00.000Z");
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken(oldToken) };
    const { db, shareUpsert } = makeDb({ share });

    const result = await createOrRegenerateShare(db, "invoice-1", "user-1", () => "rotated-token", () => now);

    expect(result).toEqual({ kind: "created", path: "/i/rotated-token", expiresAt: new Date("2026-10-30T00:00:00.000Z") });
    const call = shareUpsert.mock.calls[0][0] as unknown as { update: { tokenHash: string } };
    expect(call.update.tokenHash).toBe(hashShareToken("rotated-token"));
    expect(call.update.tokenHash).not.toBe(hashShareToken(oldToken));
  });
});

describe("ensureShare", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");
  const newToken = "freshly-issued-token";
  const newExpiry = new Date("2026-10-30T00:00:00.000Z");
  const neverCalled = () => {
    throw new Error("a reused share must not generate a token");
  };

  function expectIssued(shareUpsert: ReturnType<typeof makeDb>["shareUpsert"]) {
    expect(shareUpsert).toHaveBeenCalledTimes(1);
    const call = shareUpsert.mock.calls[0][0] as unknown as {
      where: { invoiceId: string };
      update: { tokenHash: string; tokenCiphertext: string; expiresAt: Date };
    };
    expect(call.where).toEqual({ invoiceId: "invoice-1" });
    expect(call.update.tokenHash).toBe(hashShareToken(newToken));
    expect(decryptShareToken(call.update.tokenCiphertext)).toBe(newToken);
    expect(call.update.expiresAt).toEqual(newExpiry);
  }

  it("returns not-found for an invoice not owned by the requesting user, without reading or writing a share", async () => {
    const usable: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken("someone-elses-token") };
    const { db, invoiceFindFirst, shareFindUnique, shareUpsert } = makeDb({ invoice: null, share: usable });

    const result = await ensureShare(db, "invoice-1", "user-2", () => newToken, () => now);

    expect(result).toEqual({ kind: "not-found" });
    expect(invoiceFindFirst).toHaveBeenCalledWith({ where: { id: "invoice-1", userId: "user-2" } });
    expect(shareFindUnique).not.toHaveBeenCalled();
    expect(shareUpsert).not.toHaveBeenCalled();
  });

  it("reuses an unexpired, recoverable share: same path, same expiry, nothing written", async () => {
    const token = "the-link-the-brand-already-has";
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken(token) };
    const { db, shareUpsert } = makeDb({ share });

    const result = await ensureShare(db, "invoice-1", "user-1", neverCalled, () => now);

    expect(result).toEqual({ kind: "reused", path: `/i/${token}`, expiresAt: existingShare.expiresAt });
    expect(shareUpsert).not.toHaveBeenCalled();
  });

  it("reuses a recoverable share with no expiry (legacy rows never expire)", async () => {
    const token = "legacy-no-expiry-token";
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken(token), expiresAt: null };
    const { db, shareUpsert } = makeDb({ share });

    const result = await ensureShare(db, "invoice-1", "user-1", neverCalled, () => now);

    expect(result).toEqual({ kind: "reused", path: `/i/${token}`, expiresAt: null });
    expect(shareUpsert).not.toHaveBeenCalled();
  });

  it("reuses on every call: repeated reminders never rotate", async () => {
    const token = "stable-across-reminders";
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken(token) };
    const { db, shareUpsert } = makeDb({ share });

    const first = await ensureShare(db, "invoice-1", "user-1", neverCalled, () => now);
    const second = await ensureShare(db, "invoice-1", "user-1", neverCalled, () => new Date("2026-08-15T00:00:00.000Z"));

    expect(second).toEqual(first);
    expect(shareUpsert).not.toHaveBeenCalled();
  });

  it("creates a share when none exists", async () => {
    const { db, shareUpsert } = makeDb({ share: null });

    const result = await ensureShare(db, "invoice-1", "user-1", () => newToken, () => now);

    expect(result).toEqual({ kind: "created", path: `/i/${newToken}`, expiresAt: newExpiry });
    expectIssued(shareUpsert);
  });

  it("replaces an expired share instead of sending its link", async () => {
    const expiredToken = "expired-token-must-not-be-sent";
    const share: InvoiceShareRecord = {
      ...existingShare,
      tokenCiphertext: encryptShareToken(expiredToken),
      expiresAt: new Date("2026-07-31T23:59:59.999Z"),
    };
    const { db, shareUpsert } = makeDb({ share });

    const result = await ensureShare(db, "invoice-1", "user-1", () => newToken, () => now);

    expect(result).toEqual({ kind: "created", path: `/i/${newToken}`, expiresAt: newExpiry });
    expectIssued(shareUpsert);
  });

  it("treats a share expiring exactly now as expired, like the public lookup does", async () => {
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken("edge-token"), expiresAt: now };
    const { db, shareUpsert } = makeDb({ share });

    const result = await ensureShare(db, "invoice-1", "user-1", () => newToken, () => now);

    expect(result.kind).toBe("created");
    expectIssued(shareUpsert);
  });

  it("does not extend the expiry of a share it reuses, even one millisecond before it lapses", async () => {
    const token = "about-to-expire-token";
    const expiresAt = new Date(now.getTime() + 1);
    const share: InvoiceShareRecord = { ...existingShare, tokenCiphertext: encryptShareToken(token), expiresAt };
    const { db, shareUpsert } = makeDb({ share });

    const result = await ensureShare(db, "invoice-1", "user-1", neverCalled, () => now);

    expect(result).toEqual({ kind: "reused", path: `/i/${token}`, expiresAt });
    expect(shareUpsert).not.toHaveBeenCalled();
  });

  it("creates a new link for an unexpired share that predates tokenCiphertext (path unrecoverable)", async () => {
    const { db, shareUpsert } = makeDb({ share: existingShare });

    const result = await ensureShare(db, "invoice-1", "user-1", () => newToken, () => now);

    expect(result).toEqual({ kind: "created", path: `/i/${newToken}`, expiresAt: newExpiry });
    expectIssued(shareUpsert);
  });

  it("creates a new link when the stored ciphertext is corrupted", async () => {
    const { db, shareUpsert } = makeDb({ share: { ...existingShare, tokenCiphertext: "v1.not.valid.ciphertext" } });

    const result = await ensureShare(db, "invoice-1", "user-1", () => newToken, () => now);

    expect(result.kind).toBe("created");
    expectIssued(shareUpsert);
  });

  it("creates a new link when AUTH_SECRET rotated since the ciphertext was written", async () => {
    const tokenCiphertext = encryptShareToken("written-under-the-old-secret", "a-previous-secret");
    const { db, shareUpsert } = makeDb({ share: { ...existingShare, tokenCiphertext } });

    const result = await ensureShare(db, "invoice-1", "user-1", () => newToken, () => now);

    expect(result.kind).toBe("created");
    expectIssued(shareUpsert);
  });
});

describe("revokeShare", () => {
  it("returns not-found for an invoice not owned by the requesting user", async () => {
    const { db, shareDeleteMany } = makeDb({ invoice: null });

    const result = await revokeShare(db, "invoice-1", "user-2");

    expect(result).toEqual({ kind: "not-found" });
    expect(shareDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes the share row for an owned invoice", async () => {
    const { db, shareDeleteMany } = makeDb({ share: existingShare });

    const result = await revokeShare(db, "invoice-1", "user-1");

    expect(result).toEqual({ kind: "revoked" });
    expect(shareDeleteMany).toHaveBeenCalledWith({ where: { invoiceId: "invoice-1" } });
  });

  it("is idempotent when no share row exists", async () => {
    const { db } = makeDb({ share: null });

    const result = await revokeShare(db, "invoice-1", "user-1");

    expect(result).toEqual({ kind: "revoked" });
  });
});

describe("getPublicInvoiceDocumentByToken", () => {
  function makeLookupDb(row: unknown) {
    const findUnique = vi.fn<PublicInvoiceDocumentLookupDb["invoiceShare"]["findUnique"]>(
      async () => row as Awaited<ReturnType<PublicInvoiceDocumentLookupDb["invoiceShare"]["findUnique"]>>,
    );
    const db = { invoiceShare: { findUnique } } as unknown as PublicInvoiceDocumentLookupDb;
    return { db, findUnique };
  }

  const fullRow = {
    expiresAt: new Date("2026-10-17T00:00:00.000Z"),
    invoice: {
      id: "invoice-1",
      number: "INV/2026/07/001",
      subtotalIdr: 1_500_000,
      withholdingTaxType: "PPH23" as const,
      dueDate: new Date("2026-07-31T00:00:00.000Z"),
      createdAt: new Date("2026-07-15T00:00:00.000Z"),
      deal: { brand: "Brand Kopi", contactName: "Budi", scope: "1 reel + 2 story", paymentTerms: "Lunas di muka" },
      user: {
        settings: {
          issuerName: "Kenji",
          issuerAddress: "Jl. Melati",
          issuerWhatsapp: "0812",
          issuerEmail: "k@example.com",
          bankName: "BCA",
          bankAccountNumber: "123",
          bankAccountHolder: "Kenji",
        },
      },
    },
  };

  it("reports invalid for an unknown token without distinguishing it from a revoked one", async () => {
    const { db } = makeLookupDb(null);

    expect(await getPublicInvoiceDocumentByToken(db, "unknown-token")).toEqual({ kind: "invalid" });
  });

  it("reports invalid for a malformed token by hashing it like any other input (no special-cased branch)", async () => {
    const { db } = makeLookupDb(null);

    expect(await getPublicInvoiceDocumentByToken(db, "not base64url !! %%")).toEqual({ kind: "invalid" });
  });

  it("looks up by the SHA-256 hash of the presented token, never the plaintext", async () => {
    const { db, findUnique } = makeLookupDb(null);

    await getPublicInvoiceDocumentByToken(db, "some-plaintext-token");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashShareToken("some-plaintext-token") } }),
    );
  });

  it("queries with an exact select projection, never a full-relation include", async () => {
    const { db, findUnique } = makeLookupDb(null);

    await getPublicInvoiceDocumentByToken(db, "some-plaintext-token");

    const call = findUnique.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(call).not.toHaveProperty("include");
    expect(call.select).toEqual({
      expiresAt: true,
      invoice: {
        select: {
          id: true,
          number: true,
          subtotalIdr: true,
          withholdingTaxType: true,
          dueDate: true,
          createdAt: true,
          deal: { select: { brand: true, contactName: true, scope: true, paymentTerms: true } },
          user: {
            select: {
              settings: {
                select: {
                  issuerName: true,
                  issuerAddress: true,
                  issuerWhatsapp: true,
                  issuerEmail: true,
                  bankName: true,
                  bankAccountNumber: true,
                  bankAccountHolder: true,
                },
              },
            },
          },
        },
      },
    });
  });

  it("projects a ready-to-render InvoiceDocumentInput for a live token", async () => {
    const { db } = makeLookupDb(fullRow);

    const result = await getPublicInvoiceDocumentByToken(db, "token");

    expect(result).toEqual({
      kind: "ok",
      input: {
        invoice: {
          id: "invoice-1",
          number: "INV/2026/07/001",
          subtotalIdr: 1_500_000,
          withholdingTaxType: "PPH23",
          dueDate: new Date("2026-07-31T00:00:00.000Z"),
          createdAt: new Date("2026-07-15T00:00:00.000Z"),
        },
        deal: { brand: "Brand Kopi", contactName: "Budi", scope: "1 reel + 2 story", paymentTerms: "Lunas di muka" },
        settings: {
          issuerName: "Kenji",
          issuerAddress: "Jl. Melati",
          issuerWhatsapp: "0812",
          issuerEmail: "k@example.com",
          bankName: "BCA",
          bankAccountNumber: "123",
          bankAccountHolder: "Kenji",
        },
      },
    });
  });

  it("normalizes a null settings row (issuer never saved Settings) to empty strings, not a crash", async () => {
    const { db } = makeLookupDb({
      ...fullRow,
      invoice: { ...fullRow.invoice, user: { settings: null } },
    });

    const result = await getPublicInvoiceDocumentByToken(db, "token");

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.input.settings).toEqual({
      issuerName: "",
      issuerAddress: "",
      issuerWhatsapp: "",
      issuerEmail: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountHolder: "",
    });
  });

  it("reports expired, distinctly from invalid, for a token that existed but is past its expiry", async () => {
    const { db } = makeLookupDb({
      ...fullRow,
      expiresAt: new Date("2026-07-18T23:59:59.999Z"),
    });

    const result = await getPublicInvoiceDocumentByToken(db, "expired-token", new Date("2026-07-19T00:00:00.000Z"));

    expect(result).toEqual({ kind: "expired" });
  });

  it("keeps a null-expiry legacy row valid indefinitely", async () => {
    const { db } = makeLookupDb({ ...fullRow, expiresAt: null });

    const result = await getPublicInvoiceDocumentByToken(db, "legacy-token", new Date("2030-01-01T00:00:00.000Z"));

    expect(result.kind).toBe("ok");
  });
});
