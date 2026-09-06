import { createHash, randomBytes } from "node:crypto";
import { getOwnedInvoice, type InvoiceReadDb, type WithholdingTaxType } from "./invoices";
import { decryptShareToken, encryptShareToken } from "./share-token-crypto";
import type { InvoiceDocumentInput } from "@/components/documents/invoice-document/model";

const TOKEN_BYTES = 32;
export const DEFAULT_SHARE_LIFETIME_DAYS = 90;

export function generateShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type InvoiceShareRecord = {
  id: string;
  invoiceId: string;
  tokenHash: string;
  tokenCiphertext: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceShareDb = InvoiceReadDb & {
  invoiceShare: {
    findUnique(args: { where: { invoiceId: string } }): Promise<InvoiceShareRecord | null>;
    upsert(args: {
      where: { invoiceId: string };
      create: { invoiceId: string; tokenHash: string; tokenCiphertext: string; expiresAt: Date };
      update: { tokenHash: string; tokenCiphertext: string; expiresAt: Date };
    }): Promise<InvoiceShareRecord>;
    deleteMany(args: { where: { invoiceId: string } }): Promise<{ count: number }>;
  };
};

export type ShareStateResult =
  | { kind: "not-found" }
  | { kind: "state"; active: false }
  | { kind: "state"; active: true; path: string | null; expiresAt: Date | null };

// Active means a share row exists; revoking deletes the row rather than flagging it,
// so a revoked token's hash is simply absent — indistinguishable from unknown/invalid.
// path is the owner's own already-active link, recovered by decrypting
// tokenCiphertext (see share-token-crypto.ts) -- null only for a share that
// predates that column (created before this recovery existed) or whose
// ciphertext fails to decrypt, in which case the owner falls back to
// regenerating, exactly like before this existed.
export async function getShareState(
  db: InvoiceShareDb,
  invoiceId: string,
  userId: string,
): Promise<ShareStateResult> {
  const invoice = await getOwnedInvoice(db, invoiceId, userId);
  if (!invoice) return { kind: "not-found" };

  const share = await db.invoiceShare.findUnique({ where: { invoiceId } });
  if (!share) return { kind: "state", active: false };

  const token = share.tokenCiphertext ? decryptShareToken(share.tokenCiphertext) : null;
  return { kind: "state", active: true, path: token ? `/i/${token}` : null, expiresAt: share.expiresAt };
}

export type CreateShareResult =
  | { kind: "not-found" }
  | { kind: "created"; path: string; expiresAt: Date };

export async function createOrRegenerateShare(
  db: InvoiceShareDb,
  invoiceId: string,
  userId: string,
  tokenFactory: () => string = generateShareToken,
  nowFactory: () => Date = () => new Date(),
): Promise<CreateShareResult> {
  const invoice = await getOwnedInvoice(db, invoiceId, userId);
  if (!invoice) return { kind: "not-found" };

  const token = tokenFactory();
  const tokenHash = hashShareToken(token);
  const tokenCiphertext = encryptShareToken(token);
  const expiresAt = new Date(nowFactory().getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + DEFAULT_SHARE_LIFETIME_DAYS);
  await db.invoiceShare.upsert({
    where: { invoiceId },
    create: { invoiceId, tokenHash, tokenCiphertext, expiresAt },
    update: { tokenHash, tokenCiphertext, expiresAt },
  });

  return { kind: "created", path: `/i/${token}`, expiresAt };
}

export type RevokeShareResult = { kind: "not-found" } | { kind: "revoked" };

export async function revokeShare(
  db: InvoiceShareDb,
  invoiceId: string,
  userId: string,
): Promise<RevokeShareResult> {
  const invoice = await getOwnedInvoice(db, invoiceId, userId);
  if (!invoice) return { kind: "not-found" };

  await db.invoiceShare.deleteMany({ where: { invoiceId } });
  return { kind: "revoked" };
}

// Exported so the canonical InvoiceDocument model (T-22) can reuse this exact
// label instead of reimplementing it, guaranteeing the "Tax: unchanged from
// current behaviour" parity the spec requires.
export function withholdingTaxLabel(type: WithholdingTaxType): string {
  return type === "NONE" ? "Tidak ada" : type.replace("PPH", "PPh ");
}

// T-23: extended select carrying every field the canonical InvoiceDocument
// (T-22) needs -- issuer/bank settings, deal contact name/payment terms,
// and the invoice's issue date. Also the sole select used by the PDF route
// since T-24: one query shape for both document renderers now, not two.
type PublicInvoiceDocumentJoin = {
  expiresAt: Date | null;
  invoice: {
    id: string;
    number: string;
    subtotalIdr: number;
    withholdingTaxType: WithholdingTaxType;
    dueDate: Date | null;
    createdAt: Date;
    deal: { brand: string; contactName: string | null; scope: string; paymentTerms: string | null };
    user: {
      settings: {
        issuerName: string | null;
        issuerAddress: string | null;
        issuerWhatsapp: string | null;
        issuerEmail: string | null;
        bankName: string | null;
        bankAccountNumber: string | null;
        bankAccountHolder: string | null;
      } | null;
    };
  };
};

const PUBLIC_INVOICE_DOCUMENT_SELECT = {
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
} as const;

export type PublicInvoiceDocumentLookupDb = {
  invoiceShare: {
    findUnique(args: {
      where: { tokenHash: string };
      select: typeof PUBLIC_INVOICE_DOCUMENT_SELECT;
    }): Promise<PublicInvoiceDocumentJoin | null>;
  };
};

export type PublicInvoiceDocumentLookup =
  | { kind: "ok"; input: InvoiceDocumentInput }
  | { kind: "invalid" }
  | { kind: "expired" };

function toDocumentInput(invoice: PublicInvoiceDocumentJoin["invoice"]): InvoiceDocumentInput {
  const settings = invoice.user.settings;
  return {
    invoice: {
      id: invoice.id,
      number: invoice.number,
      subtotalIdr: invoice.subtotalIdr,
      withholdingTaxType: invoice.withholdingTaxType,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
    },
    deal: {
      brand: invoice.deal.brand,
      contactName: invoice.deal.contactName,
      scope: invoice.deal.scope,
      paymentTerms: invoice.deal.paymentTerms,
    },
    settings: {
      issuerName: settings?.issuerName ?? "",
      issuerAddress: settings?.issuerAddress ?? "",
      issuerWhatsapp: settings?.issuerWhatsapp ?? "",
      issuerEmail: settings?.issuerEmail ?? "",
      bankName: settings?.bankName ?? "",
      bankAccountNumber: settings?.bankAccountNumber ?? "",
      bankAccountHolder: settings?.bankAccountHolder ?? "",
    },
  };
}

// Same hash->lookup path as the PDF lookup below (no early-exit on token
// shape: every input -- unknown, revoked, or malformed -- is hashed and
// looked up the same way, so callers can't distinguish "malformed" from
// "not found"). Unlike the PDF lookup, this distinguishes "never
// existed/malformed" from "existed, now expired" as separate UI states: the
// recipient holding a real expired link deserves a truthful answer, and
// this can't be used to guess new tokens -- only someone who already holds
// a real token can ever observe "expired" instead of "invalid".
export async function getPublicInvoiceDocumentByToken(
  db: PublicInvoiceDocumentLookupDb,
  token: string,
  now: Date = new Date(),
): Promise<PublicInvoiceDocumentLookup> {
  const tokenHash = hashShareToken(token);
  const row = await db.invoiceShare.findUnique({
    where: { tokenHash },
    select: PUBLIC_INVOICE_DOCUMENT_SELECT,
  });

  if (!row) return { kind: "invalid" };
  if (row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime()) return { kind: "expired" };
  return { kind: "ok", input: toDocumentInput(row.invoice) };
}
