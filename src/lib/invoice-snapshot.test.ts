import { describe, expect, it, vi } from "vitest";
import {
  freezeInvoiceDocument,
  frozenDocumentInput,
  isDocumentExposed,
  isIssuerIncomplete,
  liveDocumentInput,
  resolveOwnerInvoiceDocument,
  type InvoiceDocumentDb,
} from "./invoice-snapshot";

const invoice = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/10/001",
  subtotalIdr: 2_500_000,
  withholdingTaxType: "PPH23" as const,
  status: "DRAFT" as const,
  dueDate: new Date("2026-11-01T00:00:00.000Z"),
  createdAt: new Date("2026-10-18T00:00:00.000Z"),
};

const liveDeal = { brand: "Brand Sekarang", contactName: "Kontak Sekarang", scope: "Scope sekarang", paymentTerms: "Termin sekarang" };
const liveSettings = {
  issuerName: "Penerbit Sekarang",
  issuerAddress: null,
  issuerWhatsapp: null,
  issuerEmail: null,
  bankName: "Bank Sekarang",
  bankAccountNumber: "111",
  bankAccountHolder: "Pemilik Sekarang",
};
const snapshot = {
  brand: "Brand Saat Terbit",
  contactName: null,
  scope: "Scope saat terbit",
  paymentTerms: null,
  issuerName: "Penerbit Saat Terbit",
  issuerAddress: "Jl. Lama",
  issuerWhatsapp: null,
  issuerEmail: null,
  bankName: "Bank Lama",
  bankAccountNumber: "999",
  bankAccountHolder: "Pemilik Lama",
};

function makeDb(options: { snapshots?: Array<typeof snapshot | null>; share?: { id: string } | null; deal?: typeof liveDeal | null }) {
  const snapshots = [...(options.snapshots ?? [null])];
  const snapshotFindUnique = vi.fn(async () => (snapshots.length > 1 ? snapshots.shift()! : snapshots[0]));
  const executeRaw = vi.fn<(query: unknown) => Promise<number>>(async () => 1);
  const shareFindUnique = vi.fn(async () => options.share ?? null);
  const dealFindFirst = vi.fn(async () => (options.deal === undefined ? liveDeal : options.deal));
  const settingsFindUnique = vi.fn(async () => liveSettings);
  const db = {
    $executeRaw: executeRaw,
    invoiceSnapshot: { findUnique: snapshotFindUnique },
    invoiceShare: { findUnique: shareFindUnique },
    deal: { findFirst: dealFindFirst },
    userSettings: { findUnique: settingsFindUnique },
  } as unknown as InvoiceDocumentDb;
  return { db, executeRaw, dealFindFirst, settingsFindUnique, shareFindUnique };
}

describe("freezeInvoiceDocument", () => {
  it("is one owner-scoped INSERT ... SELECT that never overwrites an existing snapshot", async () => {
    const executeRaw = vi.fn<(query: unknown) => Promise<number>>(async () => 1);

    await freezeInvoiceDocument({ $executeRaw: executeRaw } as never, "invoice-1", "user-1", "STATUS_CHANGE");

    const query = executeRaw.mock.calls[0][0] as unknown as { strings: string[]; values: unknown[] };
    const sql = query.strings.join("?");
    expect(sql).toMatch(/^\s*INSERT INTO "InvoiceSnapshot"/);
    expect(sql).toContain('WHERE i."id" = ? AND i."userId" = ?');
    expect(sql).toContain('JOIN "Deal" d ON d."id" = i."dealId" AND d."userId" = i."userId"');
    expect(sql).toContain('ON CONFLICT ("invoiceId") DO NOTHING');
    expect(sql).not.toMatch(/DO UPDATE|UPDATE "InvoiceSnapshot"/);
    expect(query.values).toEqual(["STATUS_CHANGE", "invoice-1", "user-1"]);
  });

  it("labels a capture CAPTURED_ON_ISSUE only for a Draft that has no share yet", async () => {
    const executeRaw = vi.fn<(query: unknown) => Promise<number>>(async () => 1);

    await freezeInvoiceDocument({ $executeRaw: executeRaw } as never, "invoice-1", "user-1", "SHARE_LINK");

    const sql = (executeRaw.mock.calls[0][0] as unknown as { strings: string[] }).strings.join("?");
    expect(sql).toMatch(/WHEN i\."status" = 'DRAFT' AND NOT EXISTS \(SELECT 1 FROM "InvoiceShare"[^)]*\)\s*THEN 'CAPTURED_ON_ISSUE'/);
    expect(sql).toMatch(/ELSE 'RECONSTRUCTED_LATE'/);
  });
});

describe("isDocumentExposed", () => {
  it("is false only for a Draft without a share", () => {
    expect(isDocumentExposed({ status: "DRAFT" }, false)).toBe(false);
    expect(isDocumentExposed({ status: "DRAFT" }, true)).toBe(true);
    for (const status of ["SENT", "DUE", "OVERDUE", "PAID"] as const) {
      expect(isDocumentExposed({ status }, false)).toBe(true);
    }
  });
});

describe("document inputs", () => {
  it("a frozen document takes invoice-owned fields from the invoice and the rest from the snapshot only", () => {
    const input = frozenDocumentInput(invoice, snapshot);

    expect(input.invoice).toEqual({
      id: "invoice-1",
      number: "INV/2026/10/001",
      subtotalIdr: 2_500_000,
      withholdingTaxType: "PPH23",
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
    });
    expect(input.deal).toEqual({ brand: "Brand Saat Terbit", contactName: null, scope: "Scope saat terbit", paymentTerms: null });
    expect(input.settings).toEqual({
      issuerName: "Penerbit Saat Terbit",
      issuerAddress: "Jl. Lama",
      issuerWhatsapp: "",
      issuerEmail: "",
      bankName: "Bank Lama",
      bankAccountNumber: "999",
      bankAccountHolder: "Pemilik Lama",
    });
  });

  it("a live Draft with no Settings row renders empty issuer fields, not a crash", () => {
    expect(liveDocumentInput(invoice, liveDeal, null).settings.issuerName).toBe("");
  });

  it("isIssuerIncomplete needs an issuer name and all three bank fields", () => {
    const complete = frozenDocumentInput(invoice, snapshot).settings;
    expect(isIssuerIncomplete(complete)).toBe(false);
    expect(isIssuerIncomplete({ ...complete, bankAccountHolder: "  " })).toBe(true);
    expect(isIssuerIncomplete({ ...complete, issuerName: "" })).toBe(true);
  });
});

describe("resolveOwnerInvoiceDocument", () => {
  it("a never-exposed Draft follows the live deal and Settings and writes nothing", async () => {
    const { db, executeRaw, dealFindFirst } = makeDb({});

    const result = await resolveOwnerInvoiceDocument(db, invoice);

    expect(result?.frozen).toBe(false);
    expect(result?.input.deal.brand).toBe("Brand Sekarang");
    expect(result?.input.settings.bankName).toBe("Bank Sekarang");
    expect(executeRaw).not.toHaveBeenCalled();
    expect(dealFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "deal-1", userId: "user-1" } }));
  });

  it("a frozen invoice renders its snapshot and never reads the deal or Settings", async () => {
    const { db, dealFindFirst, settingsFindUnique, executeRaw } = makeDb({ snapshots: [snapshot] });

    const result = await resolveOwnerInvoiceDocument(db, { ...invoice, status: "SENT" });

    expect(result?.frozen).toBe(true);
    expect(result?.input.deal.brand).toBe("Brand Saat Terbit");
    expect(result?.input.settings.bankName).toBe("Bank Lama");
    expect(dealFindFirst).not.toHaveBeenCalled();
    expect(settingsFindUnique).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("a frozen Draft (shared, then revoked) stays frozen", async () => {
    const { db, dealFindFirst } = makeDb({ snapshots: [snapshot], share: null });

    const result = await resolveOwnerInvoiceDocument(db, invoice);

    expect(result?.frozen).toBe(true);
    expect(dealFindFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["a sent invoice", { status: "SENT" as const }, null],
    ["a shared Draft", { status: "DRAFT" as const }, { id: "share-1" }],
  ])("%s without a snapshot is frozen now (DOCUMENT_READ) and rendered from that copy", async (_label, override, share) => {
    const { db, executeRaw, dealFindFirst } = makeDb({ snapshots: [null, snapshot], share });

    const result = await resolveOwnerInvoiceDocument(db, { ...invoice, ...override });

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect((executeRaw.mock.calls[0] as unknown as [{ values: unknown[] }])[0].values).toEqual(["DOCUMENT_READ", "invoice-1", "user-1"]);
    expect(result).toEqual({ frozen: true, input: frozenDocumentInput({ ...invoice, ...override }, snapshot) });
    expect(dealFindFirst).not.toHaveBeenCalled();
  });

  it("an exposed invoice whose snapshot cannot be captured throws instead of rendering live values", async () => {
    const { db, dealFindFirst } = makeDb({ snapshots: [null], share: { id: "share-1" } });

    await expect(resolveOwnerInvoiceDocument(db, { ...invoice, status: "PAID" })).rejects.toThrow(/no document snapshot/);
    expect(dealFindFirst).not.toHaveBeenCalled();
  });

  it("returns null for a Draft whose deal is missing", async () => {
    const { db } = makeDb({ deal: null });

    expect(await resolveOwnerInvoiceDocument(db, invoice)).toBeNull();
  });
});
