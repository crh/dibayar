import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { InvoiceDocumentInput, InvoiceDocumentSettings } from "@/components/documents/invoice-document/model";
import type { InvoiceStatus, WithholdingTaxType } from "./invoices";

// Decision A (issue #55, approved 2026-10-18; docs/product/DECISION-BRIEF-2026-10-17.md).
//
// An invoice's document shows two kinds of fields:
//   - invoice-owned: number, subtotal, PPh, due date, issue date (createdAt).
//     They live on Invoice under their existing contract and are rendered
//     from there for every invoice. The due date keeps its explicit editor
//     (MAN-DUE-01): changing it is a deliberate edit of the invoice itself,
//     not a side effect of a deal or Settings change.
//   - deal- and Settings-derived: brand, contact name, scope, payment terms,
//     issuer identity and bank details. A Draft that has never been exposed
//     renders them live. At the first exposure -- the move out of DRAFT or
//     the first share link, whichever comes first -- they are copied once
//     into InvoiceSnapshot, in the same transaction as that exposure, and
//     every renderer (the owner's PDF, the brand's /i/ page and its PDF)
//     reads the copy from then on. Nothing thaws it: there is no move back
//     to DRAFT, and a revoked or rotated link leaves it in place.

export type InvoiceSnapshotProvenance = "CAPTURED_ON_ISSUE" | "RECONSTRUCTED_ON_MIGRATION" | "RECONSTRUCTED_LATE";
export type InvoiceSnapshotTrigger = "STATUS_CHANGE" | "SHARE_LINK" | "DOCUMENT_READ" | "MIGRATION";

export type InvoiceSnapshotRecord = {
  id: string;
  invoiceId: string;
  brand: string;
  contactName: string | null;
  scope: string;
  paymentTerms: string | null;
  issuerSettingsPresent: boolean;
  issuerName: string | null;
  issuerAddress: string | null;
  issuerWhatsapp: string | null;
  issuerEmail: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  provenance: InvoiceSnapshotProvenance;
  trigger: InvoiceSnapshotTrigger;
  sourceDealUpdatedAt: Date;
  sourceSettingsUpdatedAt: Date | null;
  capturedAt: Date;
};

export type InvoiceSnapshotWriteClient = Pick<PrismaClient, "$executeRaw">;

// The one write path for a snapshot, used by every exposure boundary. A
// single INSERT ... SELECT reads the deal and Settings and writes the copy in
// one statement, so the copy is a consistent view of committed rows, and ON
// CONFLICT DO NOTHING makes it exactly-once: a repeat, a retry, or two
// requests racing to expose the same invoice leave the first copy as it
// was. Owner-scoped: an invoice or deal of another user matches no row.
//
// Provenance is decided from the state *before* the exposure this call
// belongs to, which is why callers run it ahead of their own status change or
// share write inside the same transaction: a Draft with no share yet is
// being issued now (CAPTURED_ON_ISSUE); anything else was already out
// without a snapshot -- e.g. sent while the previous app version was still
// serving after the migration ran -- and is labelled RECONSTRUCTED_LATE.
//
// Returns the number of rows written (0 or 1).
export async function freezeInvoiceDocument(
  client: InvoiceSnapshotWriteClient,
  invoiceId: string,
  userId: string,
  trigger: Exclude<InvoiceSnapshotTrigger, "MIGRATION">,
): Promise<number> {
  return client.$executeRaw(Prisma.sql`
    INSERT INTO "InvoiceSnapshot" (
      "id", "invoiceId", "brand", "contactName", "scope", "paymentTerms",
      "issuerSettingsPresent", "issuerName", "issuerAddress", "issuerWhatsapp", "issuerEmail",
      "bankName", "bankAccountNumber", "bankAccountHolder",
      "provenance", "trigger", "sourceDealUpdatedAt", "sourceSettingsUpdatedAt"
    )
    SELECT
      gen_random_uuid()::text, i."id", d."brand", d."contactName", d."scope", d."paymentTerms",
      s."id" IS NOT NULL, s."issuerName", s."issuerAddress", s."issuerWhatsapp", s."issuerEmail",
      s."bankName", s."bankAccountNumber", s."bankAccountHolder",
      CASE
        WHEN i."status" = 'DRAFT' AND NOT EXISTS (SELECT 1 FROM "InvoiceShare" sh WHERE sh."invoiceId" = i."id")
          THEN 'CAPTURED_ON_ISSUE'::"InvoiceSnapshotProvenance"
        ELSE 'RECONSTRUCTED_LATE'::"InvoiceSnapshotProvenance"
      END,
      ${trigger}::"InvoiceSnapshotTrigger", d."updatedAt", s."updatedAt"
    FROM "Invoice" i
    JOIN "Deal" d ON d."id" = i."dealId" AND d."userId" = i."userId"
    LEFT JOIN "UserSettings" s ON s."userId" = i."userId"
    WHERE i."id" = ${invoiceId} AND i."userId" = ${userId}
    ON CONFLICT ("invoiceId") DO NOTHING
  `);
}

// An invoice whose document must come from a snapshot: it has left DRAFT,
// or a share row exists (active or expired). A Draft without a share has
// never been reachable by the brand and still follows its deal.
export function isDocumentExposed(invoice: { status: InvoiceStatus }, hasShare: boolean): boolean {
  return invoice.status !== "DRAFT" || hasShare;
}

type InvoiceDocumentFields = {
  id: string;
  number: string;
  subtotalIdr: number;
  withholdingTaxType: WithholdingTaxType;
  dueDate: Date | string | null;
  createdAt: Date | string;
};

type LiveDeal = { brand: string; contactName: string | null; scope: string; paymentTerms: string | null };
type LiveSettings = {
  issuerName: string | null;
  issuerAddress: string | null;
  issuerWhatsapp: string | null;
  issuerEmail: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
} | null;

function documentInvoice(invoice: InvoiceDocumentFields): InvoiceDocumentInput["invoice"] {
  return {
    id: invoice.id,
    number: invoice.number,
    subtotalIdr: invoice.subtotalIdr,
    withholdingTaxType: invoice.withholdingTaxType,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
  };
}

function documentSettings(settings: LiveSettings): InvoiceDocumentSettings {
  return {
    issuerName: settings?.issuerName ?? "",
    issuerAddress: settings?.issuerAddress ?? "",
    issuerWhatsapp: settings?.issuerWhatsapp ?? "",
    issuerEmail: settings?.issuerEmail ?? "",
    bankName: settings?.bankName ?? "",
    bankAccountNumber: settings?.bankAccountNumber ?? "",
    bankAccountHolder: settings?.bankAccountHolder ?? "",
  };
}

// A Draft that has never been exposed: deal and Settings as they are now.
export function liveDocumentInput(invoice: InvoiceDocumentFields, deal: LiveDeal, settings: LiveSettings): InvoiceDocumentInput {
  return {
    invoice: documentInvoice(invoice),
    deal: { brand: deal.brand, contactName: deal.contactName, scope: deal.scope, paymentTerms: deal.paymentTerms },
    settings: documentSettings(settings),
  };
}

type SnapshotDocumentFields = Pick<
  InvoiceSnapshotRecord,
  | "brand"
  | "contactName"
  | "scope"
  | "paymentTerms"
  | "issuerName"
  | "issuerAddress"
  | "issuerWhatsapp"
  | "issuerEmail"
  | "bankName"
  | "bankAccountNumber"
  | "bankAccountHolder"
>;

// An exposed invoice: invoice-owned fields from the invoice, everything else
// from its snapshot. Nothing here reads the deal or Settings.
export function frozenDocumentInput(invoice: InvoiceDocumentFields, snapshot: SnapshotDocumentFields): InvoiceDocumentInput {
  return {
    invoice: documentInvoice(invoice),
    deal: {
      brand: snapshot.brand,
      contactName: snapshot.contactName,
      scope: snapshot.scope,
      paymentTerms: snapshot.paymentTerms,
    },
    settings: documentSettings(snapshot),
  };
}

// The same "complete enough to pay" rule invoice detail has always used,
// applied to whichever settings the document actually shows.
export function isIssuerIncomplete(settings: InvoiceDocumentSettings): boolean {
  return !settings.issuerName.trim() || !settings.bankName.trim() || !settings.bankAccountNumber.trim() || !settings.bankAccountHolder.trim();
}

export class InvoiceSnapshotMissingError extends Error {
  constructor(invoiceId: string) {
    super(`Exposed invoice ${invoiceId} has no document snapshot and none could be captured`);
    this.name = "InvoiceSnapshotMissingError";
  }
}

const SNAPSHOT_DOCUMENT_SELECT = {
  brand: true,
  contactName: true,
  scope: true,
  paymentTerms: true,
  issuerName: true,
  issuerAddress: true,
  issuerWhatsapp: true,
  issuerEmail: true,
  bankName: true,
  bankAccountNumber: true,
  bankAccountHolder: true,
} as const;

export type InvoiceDocumentDb = InvoiceSnapshotWriteClient & {
  invoiceSnapshot: {
    findUnique(args: { where: { invoiceId: string }; select: typeof SNAPSHOT_DOCUMENT_SELECT }): Promise<SnapshotDocumentFields | null>;
  };
  invoiceShare: {
    findUnique(args: { where: { invoiceId: string }; select: { id: true } }): Promise<{ id: string } | null>;
  };
  deal: {
    findFirst(args: {
      where: { id: string; userId: string };
      select: { brand: true; contactName: true; scope: true; paymentTerms: true };
    }): Promise<LiveDeal | null>;
  };
  userSettings: {
    findUnique(args: {
      where: { userId: string };
      select: {
        issuerName: true;
        issuerAddress: true;
        issuerWhatsapp: true;
        issuerEmail: true;
        bankName: true;
        bankAccountNumber: true;
        bankAccountHolder: true;
      };
    }): Promise<LiveSettings>;
  };
};

export type DocumentInputResult = { input: InvoiceDocumentInput; frozen: boolean } | null;

type SnapshotReadWriteDb = Pick<InvoiceDocumentDb, "$executeRaw" | "invoiceSnapshot">;

async function readSnapshot(db: SnapshotReadWriteDb, invoiceId: string) {
  return db.invoiceSnapshot.findUnique({ where: { invoiceId }, select: SNAPSHOT_DOCUMENT_SELECT });
}

// The document an owner-scoped invoice shows right now. For an exposed
// invoice with no snapshot (sent or shared by the previous app version after
// the migration ran) it freezes one first, labelled RECONSTRUCTED_LATE, and
// never falls back to the live deal: if no snapshot can be read even then,
// it throws rather than render values that may have changed since issue.
// null only when the deal is missing (FK RESTRICT makes that theoretical).
export async function resolveOwnerInvoiceDocument(
  db: InvoiceDocumentDb,
  invoice: InvoiceDocumentFields & { userId: string; dealId: string; status: InvoiceStatus },
): Promise<DocumentInputResult> {
  let snapshot = await readSnapshot(db, invoice.id);
  if (!snapshot) {
    const share = await db.invoiceShare.findUnique({ where: { invoiceId: invoice.id }, select: { id: true } });
    if (isDocumentExposed(invoice, share !== null)) {
      await freezeInvoiceDocument(db, invoice.id, invoice.userId, "DOCUMENT_READ");
      snapshot = await readSnapshot(db, invoice.id);
      if (!snapshot) throw new InvoiceSnapshotMissingError(invoice.id);
    }
  }
  if (snapshot) return { input: frozenDocumentInput(invoice, snapshot), frozen: true };

  const deal = await db.deal.findFirst({
    where: { id: invoice.dealId, userId: invoice.userId },
    select: { brand: true, contactName: true, scope: true, paymentTerms: true },
  });
  if (!deal) return null;
  const settings = await db.userSettings.findUnique({
    where: { userId: invoice.userId },
    select: {
      issuerName: true,
      issuerAddress: true,
      issuerWhatsapp: true,
      issuerEmail: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
    },
  });
  return { input: liveDocumentInput(invoice, deal, settings), frozen: false };
}

// The brand's /i/ page and PDF: a share row exists by definition, so the
// document always comes from the snapshot. Same late-capture and fail-closed
// rule as above.
export async function resolvePublicInvoiceDocument(
  db: SnapshotReadWriteDb,
  invoice: InvoiceDocumentFields & { userId: string },
  snapshot: SnapshotDocumentFields | null,
): Promise<InvoiceDocumentInput> {
  let frozen = snapshot;
  if (!frozen) {
    await freezeInvoiceDocument(db, invoice.id, invoice.userId, "DOCUMENT_READ");
    frozen = await readSnapshot(db, invoice.id);
    if (!frozen) throw new InvoiceSnapshotMissingError(invoice.id);
  }
  return frozenDocumentInput(invoice, frozen);
}

export { SNAPSHOT_DOCUMENT_SELECT };
