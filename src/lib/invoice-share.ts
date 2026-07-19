import { createHash, randomBytes } from "node:crypto";
import { getOwnedInvoice, type InvoiceReadDb, type InvoiceRecord, type InvoiceStatus, type WithholdingTaxType } from "./invoices";

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
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceShareDb = InvoiceReadDb & {
  invoiceShare: {
    findUnique(args: { where: { invoiceId: string } }): Promise<InvoiceShareRecord | null>;
    upsert(args: {
      where: { invoiceId: string };
      create: { invoiceId: string; tokenHash: string; expiresAt: Date };
      update: { tokenHash: string; expiresAt: Date };
    }): Promise<InvoiceShareRecord>;
    deleteMany(args: { where: { invoiceId: string } }): Promise<{ count: number }>;
  };
};

export type ShareStateResult =
  | { kind: "not-found" }
  | { kind: "state"; active: false }
  | { kind: "state"; active: true; expiresAt: Date | null };

// Active means a share row exists; revoking deletes the row rather than flagging it,
// so a revoked token's hash is simply absent — indistinguishable from unknown/invalid.
export async function getShareState(
  db: InvoiceShareDb,
  invoiceId: string,
  userId: string,
): Promise<ShareStateResult> {
  const invoice = await getOwnedInvoice(db, invoiceId, userId);
  if (!invoice) return { kind: "not-found" };

  const share = await db.invoiceShare.findUnique({ where: { invoiceId } });
  return share
    ? { kind: "state", active: true, expiresAt: share.expiresAt }
    : { kind: "state", active: false };
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
  const expiresAt = new Date(nowFactory().getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + DEFAULT_SHARE_LIFETIME_DAYS);
  await db.invoiceShare.upsert({
    where: { invoiceId },
    create: { invoiceId, tokenHash, expiresAt },
    update: { tokenHash, expiresAt },
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

export type PublicInvoiceView = {
  number: string;
  subtotalIdr: number;
  withholdingTaxLabel: string;
  status: InvoiceStatus;
  dueDate: Date | null;
  brand: string;
  scope: string;
  issuerName: string | null;
};

type PublicInvoiceJoin = {
  expiresAt: Date | null;
  invoice: {
    number: string;
    subtotalIdr: number;
    withholdingTaxType: WithholdingTaxType;
    status: InvoiceStatus;
    dueDate: Date | null;
    deal: { brand: string; scope: string };
    user: { name: string | null };
  };
};

const PUBLIC_INVOICE_SELECT = {
  expiresAt: true,
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
} as const;

export type PublicInvoiceLookupDb = {
  invoiceShare: {
    findUnique(args: {
      where: { tokenHash: string };
      select: typeof PUBLIC_INVOICE_SELECT;
    }): Promise<PublicInvoiceJoin | null>;
  };
};

function withholdingTaxLabel(type: WithholdingTaxType): string {
  return type === "NONE" ? "Tidak ada" : type.replace("PPH", "PPh ");
}

function toPublicView(invoice: PublicInvoiceJoin["invoice"]): PublicInvoiceView {
  return {
    number: invoice.number,
    subtotalIdr: invoice.subtotalIdr,
    withholdingTaxLabel: withholdingTaxLabel(invoice.withholdingTaxType),
    status: invoice.status,
    dueDate: invoice.dueDate,
    brand: invoice.deal.brand,
    scope: invoice.deal.scope,
    issuerName: invoice.user.name,
  };
}

// No early-exit on token shape: every input (unknown, revoked, or malformed) is hashed
// and looked up the same way, so callers can't distinguish "malformed" from "not found".
export async function getPublicInvoiceByToken(
  db: PublicInvoiceLookupDb,
  token: string,
  now: Date = new Date(),
): Promise<PublicInvoiceView | null> {
  const tokenHash = hashShareToken(token);
  const row = await db.invoiceShare.findUnique({
    where: { tokenHash },
    select: PUBLIC_INVOICE_SELECT,
  });

  if (!row || (row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime())) return null;
  return toPublicView(row.invoice);
}

export type PublicInvoicePdfData = {
  invoice: Pick<InvoiceRecord, "number" | "subtotalIdr" | "withholdingTaxType" | "status" | "dueDate">;
  deal: { brand: string; scope: string };
};

// Same token->hash->lookup path as getPublicInvoiceByToken, projected to exactly
// what InvoicePdf renders instead of the JSON view shape.
export async function getPublicInvoicePdfDataByToken(
  db: PublicInvoiceLookupDb,
  token: string,
  now: Date = new Date(),
): Promise<PublicInvoicePdfData | null> {
  const tokenHash = hashShareToken(token);
  const row = await db.invoiceShare.findUnique({
    where: { tokenHash },
    select: PUBLIC_INVOICE_SELECT,
  });
  if (!row || (row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime())) return null;

  return {
    invoice: {
      number: row.invoice.number,
      subtotalIdr: row.invoice.subtotalIdr,
      withholdingTaxType: row.invoice.withholdingTaxType,
      status: row.invoice.status,
      dueDate: row.invoice.dueDate,
    },
    deal: { brand: row.invoice.deal.brand, scope: row.invoice.deal.scope },
  };
}
