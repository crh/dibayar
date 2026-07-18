import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  createOrRegenerateShare,
  generateShareToken,
  getPublicInvoiceByToken,
  getPublicInvoicePdfDataByToken,
  getShareState,
  hashShareToken,
  revokeShare,
  type InvoiceShareDb,
  type InvoiceShareRecord,
  type PublicInvoiceLookupDb,
} from "./invoice-share";
import type { InvoiceRecord } from "./invoices";

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
      (async ({ create }: { create: { invoiceId: string; tokenHash: string } }) => ({
        id: "share-new",
        invoiceId: create.invoiceId,
        tokenHash: create.tokenHash,
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
  it("returns not-found for an invoice not owned by the requesting user", async () => {
    const { db, shareFindUnique } = makeDb({ invoice: null });

    const result = await getShareState(db, "invoice-1", "user-2");

    expect(result).toEqual({ kind: "not-found" });
    expect(shareFindUnique).not.toHaveBeenCalled();
  });

  it("reports inactive when no share row exists", async () => {
    const { db } = makeDb({ share: null });

    const result = await getShareState(db, "invoice-1", "user-1");

    expect(result).toEqual({ kind: "state", active: false });
  });

  it("reports active without leaking the token hash", async () => {
    const { db } = makeDb({ share: existingShare });

    const result = await getShareState(db, "invoice-1", "user-1");

    expect(result).toEqual({ kind: "state", active: true });
    expect(JSON.stringify(result)).not.toContain("existing-hash");
  });
});

describe("createOrRegenerateShare", () => {
  it("returns not-found for an invoice not owned by the requesting user", async () => {
    const { db, shareUpsert } = makeDb({ invoice: null });

    const result = await createOrRegenerateShare(db, "invoice-1", "user-2");

    expect(result).toEqual({ kind: "not-found" });
    expect(shareUpsert).not.toHaveBeenCalled();
  });

  it("stores only the hash of a freshly generated token and returns the plaintext path once", async () => {
    const injectedToken = "deterministic-test-token-value";
    const { db, shareUpsert } = makeDb({});

    const result = await createOrRegenerateShare(db, "invoice-1", "user-1", () => injectedToken);

    expect(result).toEqual({ kind: "created", path: `/i/${injectedToken}` });
    expect(shareUpsert).toHaveBeenCalledWith({
      where: { invoiceId: "invoice-1" },
      create: { invoiceId: "invoice-1", tokenHash: hashShareToken(injectedToken) },
      update: { tokenHash: hashShareToken(injectedToken) },
    });
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

describe("getPublicInvoiceByToken", () => {
  function makeLookupDb(row: unknown) {
    const findUnique = vi.fn<PublicInvoiceLookupDb["invoiceShare"]["findUnique"]>(
      async () => row as Awaited<ReturnType<PublicInvoiceLookupDb["invoiceShare"]["findUnique"]>>,
    );
    const db = { invoiceShare: { findUnique } } as unknown as PublicInvoiceLookupDb;
    return { db, findUnique };
  }

  it("returns null for an unknown token without distinguishing it from a revoked one", async () => {
    const { db } = makeLookupDb(null);

    expect(await getPublicInvoiceByToken(db, "unknown-token")).toBeNull();
  });

  it("returns null for a malformed token by hashing it like any other input (no special-cased branch)", async () => {
    const { db } = makeLookupDb(null);

    expect(await getPublicInvoiceByToken(db, "not base64url !! %%")).toBeNull();
  });

  it("looks up by the SHA-256 hash of the presented token, never the plaintext", async () => {
    const { db, findUnique } = makeLookupDb(null);

    await getPublicInvoiceByToken(db, "some-plaintext-token");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashShareToken("some-plaintext-token") } }),
    );
  });

  it("queries with an exact select projection, never a full-relation include", async () => {
    const { db, findUnique } = makeLookupDb(null);

    await getPublicInvoiceByToken(db, "some-plaintext-token");

    const call = findUnique.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(call).not.toHaveProperty("include");
    expect(call.select).toEqual({
      invoice: {
        select: {
          number: true,
          subtotalIdr: true,
          withholdingTaxType: true,
          status: true,
          dueDate: true,
          deal: { select: { brand: true, scope: true } },
          user: { select: { name: true } },
        },
      },
    });
  });

  it("projects only the minimum safe invoice fields", async () => {
    const { db } = makeLookupDb({
      invoice: {
        number: "INV/2026/07/001",
        subtotalIdr: 1_500_000,
        withholdingTaxType: "PPH23",
        status: "SENT",
        dueDate: new Date("2026-07-31T00:00:00.000Z"),
        deal: { brand: "Brand Kopi", scope: "1 reel + 2 story" },
        user: { name: "Kenji" },
      },
    });

    const view = await getPublicInvoiceByToken(db, "token");

    expect(view).toEqual({
      number: "INV/2026/07/001",
      subtotalIdr: 1_500_000,
      withholdingTaxLabel: "PPh 23",
      status: "SENT",
      dueDate: new Date("2026-07-31T00:00:00.000Z"),
      brand: "Brand Kopi",
      scope: "1 reel + 2 story",
      issuerName: "Kenji",
    });
    expect(view).not.toHaveProperty("id");
    expect(view).not.toHaveProperty("userId");
    expect(view).not.toHaveProperty("dealId");
    expect(view).not.toHaveProperty("tokenHash");
  });

  it("labels NONE withholding tax as no withholding, in Bahasa", async () => {
    const { db } = makeLookupDb({
      invoice: {
        number: "INV/2026/07/002",
        subtotalIdr: 500_000,
        withholdingTaxType: "NONE",
        status: "DRAFT",
        dueDate: null,
        deal: { brand: "Brand Lain", scope: "1 post" },
        user: { name: null },
      },
    });

    const view = await getPublicInvoiceByToken(db, "token");

    expect(view?.withholdingTaxLabel).toBe("Tidak ada");
    expect(view?.issuerName).toBeNull();
  });
});

describe("getPublicInvoicePdfDataByToken", () => {
  function makeLookupDb(row: unknown) {
    const findUnique = vi.fn<PublicInvoiceLookupDb["invoiceShare"]["findUnique"]>(
      async () => row as Awaited<ReturnType<PublicInvoiceLookupDb["invoiceShare"]["findUnique"]>>,
    );
    const db = { invoiceShare: { findUnique } } as unknown as PublicInvoiceLookupDb;
    return { db, findUnique };
  }

  it("returns null for an unknown token", async () => {
    const { db } = makeLookupDb(null);

    expect(await getPublicInvoicePdfDataByToken(db, "unknown-token")).toBeNull();
  });

  it("looks up by the SHA-256 hash of the presented token", async () => {
    const { db, findUnique } = makeLookupDb(null);

    await getPublicInvoicePdfDataByToken(db, "some-plaintext-token");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashShareToken("some-plaintext-token") } }),
    );
  });

  it("queries with an exact select projection, never a full-relation include", async () => {
    const { db, findUnique } = makeLookupDb(null);

    await getPublicInvoicePdfDataByToken(db, "some-plaintext-token");

    const call = findUnique.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(call).not.toHaveProperty("include");
    expect(call.select).toEqual({
      invoice: {
        select: {
          number: true,
          subtotalIdr: true,
          withholdingTaxType: true,
          status: true,
          dueDate: true,
          deal: { select: { brand: true, scope: true } },
          user: { select: { name: true } },
        },
      },
    });
  });

  it("returns only the fields InvoicePdf renders, nothing more", async () => {
    const { db } = makeLookupDb({
      invoice: {
        number: "INV/2026/07/001",
        subtotalIdr: 1_500_000,
        withholdingTaxType: "PPH23",
        status: "SENT",
        dueDate: new Date("2026-07-31T00:00:00.000Z"),
        deal: { brand: "Brand Kopi", scope: "1 reel + 2 story" },
        user: { name: "Kenji" },
      },
    });

    const data = await getPublicInvoicePdfDataByToken(db, "token");

    expect(data).toEqual({
      invoice: {
        number: "INV/2026/07/001",
        subtotalIdr: 1_500_000,
        withholdingTaxType: "PPH23",
        status: "SENT",
        dueDate: new Date("2026-07-31T00:00:00.000Z"),
      },
      deal: { brand: "Brand Kopi", scope: "1 reel + 2 story" },
    });
  });
});
