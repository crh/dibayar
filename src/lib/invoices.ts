import { nextInvoiceNumber } from "./invoice-number";
import { invoiceCreateSchema, type InvoiceCreateInput } from "./invoice-validation";
import { isSupportedStoredDueDate } from "./due-date";
import { createInvoiceSequenceDb, type InvoiceSequenceQueryClient } from "./invoice-sequence";
import { createOnce, type CreateOnceResult } from "./idempotency";

export type InvoiceStatus = "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID";
export type WithholdingTaxType = "NONE" | "PPH21" | "PPH23";

export type InvoiceRecord = {
  id: string;
  userId: string;
  dealId: string;
  number: string;
  subtotalIdr: number;
  withholdingTaxType: WithholdingTaxType;
  status: InvoiceStatus;
  dueDate: Date | null;
  // See createInvoiceOnce. Optional here: no client code reads it.
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OwnedDeal = { id: string; userId: string; feeIdr: number; deadline: Date | null };

type InvoiceCreateData = {
  userId: string;
  dealId: string;
  number: string;
  subtotalIdr: number;
  withholdingTaxType: WithholdingTaxType;
  status: InvoiceStatus;
  dueDate: Date | null;
  idempotencyKey?: string;
};

// Matches Prisma's $transaction callback client: raw query access for the atomic sequence adapter plus invoice.create.
export type InvoiceTransactionClient = InvoiceSequenceQueryClient & {
  invoice: {
    create(args: { data: InvoiceCreateData }): Promise<InvoiceRecord>;
  };
};

export type InvoiceCreateDb = {
  deal: {
    findFirst(args: { where: { id: string; userId: string } }): Promise<OwnedDeal | null>;
  };
  $transaction<T>(fn: (tx: InvoiceTransactionClient) => Promise<T>): Promise<T>;
};

export type InvoiceCreateOnceDb = InvoiceCreateDb & {
  invoice: {
    findFirst(args: { where: { userId: string; idempotencyKey: string } }): Promise<InvoiceRecord | null>;
  };
};

export type InvoiceReadDb = {
  invoice: {
    findMany(args: {
      where: { userId: string };
      orderBy: Array<Record<string, "asc" | "desc">>;
    }): Promise<InvoiceRecord[]>;
    findFirst(args: { where: { id: string; userId: string } }): Promise<InvoiceRecord | null>;
  };
};

export async function listInvoices(db: InvoiceReadDb, userId: string) {
  return db.invoice.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
}

export type InvoiceWithDealBrand = InvoiceRecord & { deal: { brand: string } };

export type InvoiceListDb = {
  invoice: {
    findMany(args: {
      where: { userId: string };
      orderBy: Array<Record<string, "asc" | "desc">>;
      include: { deal: { select: { brand: true } } };
    }): Promise<InvoiceWithDealBrand[]>;
  };
};

// Same owner-scoped projection as listInvoices, additionally carrying the
// related deal's brand for the invoice list route — kept as a separate
// export so listInvoices's existing callers/return shape stay untouched.
export async function listInvoicesWithDealBrand(db: InvoiceListDb, userId: string) {
  return db.invoice.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { deal: { select: { brand: true } } },
  });
}

// Returns null (not a throw) for missing or cross-tenant records so callers can respond 404 uniformly.
export async function getOwnedInvoice(db: InvoiceReadDb, id: string, userId: string) {
  return db.invoice.findFirst({ where: { id, userId } });
}

export type InvoiceByDealDb = {
  invoice: {
    findFirst(args: { where: { dealId: string; userId: string } }): Promise<InvoiceRecord | null>;
  };
};

// The deal detail page's own "is this deal already invoiced" check -- lets
// it show a direct link to the existing invoice, or the create-invoice
// action when there isn't one yet, instead of neither ever appearing there.
export async function findInvoiceByDealId(db: InvoiceByDealDb, dealId: string, userId: string) {
  return db.invoice.findFirst({ where: { dealId, userId } });
}

export type InvoiceContactDb = {
  invoice: {
    findFirst(args: {
      where: { id: string; userId: string };
      select: { deal: { select: { contactWa: true; brand: true } } };
    }): Promise<{ deal: { contactWa: string; brand: string } } | null>;
  };
};

// T-21: also carries the deal's brand, needed both for the {brand} WhatsApp
// template token and for naming the deal in the invoice-side contact repair
// note (see dibayar-implementation-spec.md T-21 acceptance).
export async function getOwnedInvoiceContact(db: InvoiceContactDb, id: string, userId: string) {
  return db.invoice.findFirst({
    where: { id, userId },
    select: { deal: { select: { contactWa: true, brand: true } } },
  });
}

export type InvoiceStatusDb = {
  invoice: {
    findFirst(args: { where: { id: string; userId: string } }): Promise<InvoiceRecord | null>;
    update(args: { where: { id: string; userId: string }; data: { status: InvoiceStatus } }): Promise<InvoiceRecord>;
  };
};

// Nothing may move an invoice *to* OVERDUE: overdue is derived from the due
// date against the Jakarta calendar day (deriveInvoiceDisplayStatus in
// invoice-date-status.ts), never assigned by hand (FIND-01). A stored
// OVERDUE row can still exist from before that rule; it stays payable.
export const ALLOWED_STATUS_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["DUE", "PAID"],
  DUE: ["PAID"],
  OVERDUE: ["PAID"],
  // T-19: undo a mistaken/reversed "paid" mark. Back to SENT specifically:
  // SENT is the neutral "awaiting payment" state, and the invoice shows as
  // overdue again on its own if its due date has passed.
  PAID: ["SENT"],
};

export type UpdateInvoiceStatusResult =
  | { kind: "updated"; invoice: InvoiceRecord }
  | { kind: "not-found" }
  | { kind: "invalid-transition" };

export async function updateInvoiceStatus(
  db: InvoiceStatusDb,
  id: string,
  userId: string,
  nextStatus: InvoiceStatus,
): Promise<UpdateInvoiceStatusResult> {
  const invoice = await db.invoice.findFirst({ where: { id, userId } });
  if (!invoice) return { kind: "not-found" };
  if (!ALLOWED_STATUS_TRANSITIONS[invoice.status].includes(nextStatus)) {
    return { kind: "invalid-transition" };
  }

  return {
    kind: "updated",
    invoice: await db.invoice.update({ where: { id, userId }, data: { status: nextStatus } }),
  };
}

export type InvoiceDueDateDb = {
  invoice: {
    findFirst(args: { where: { id: string; userId: string } }): Promise<InvoiceRecord | null>;
    update(args: { where: { id: string; userId: string }; data: { dueDate: Date | null } }): Promise<InvoiceRecord>;
  };
};

export type UpdateInvoiceDueDateResult =
  | { kind: "updated"; invoice: InvoiceRecord }
  | { kind: "not-found" }
  | { kind: "invalid-due-date" };

export async function updateInvoiceDueDate(
  db: InvoiceDueDateDb,
  id: string,
  userId: string,
  dueDate: Date | null,
): Promise<UpdateInvoiceDueDateResult> {
  // Defense in depth behind invoiceDueDateUpdateSchema: nothing reaches the
  // database outside the supported due-date range, whatever the caller.
  if (dueDate && !isSupportedStoredDueDate(dueDate)) return { kind: "invalid-due-date" };

  const invoice = await db.invoice.findFirst({ where: { id, userId } });
  if (!invoice) return { kind: "not-found" };

  return {
    kind: "updated",
    invoice: await db.invoice.update({ where: { id, userId }, data: { dueDate } }),
  };
}

// Returns null (not a throw) when the deal is missing or not owned by userId, so callers can respond 404 uniformly.
async function insertInvoice(
  db: InvoiceCreateDb,
  userId: string,
  deal: OwnedDeal,
  validated: InvoiceCreateInput,
  idempotencyKey: string | null,
) {
  return db.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(createInvoiceSequenceDb(tx), userId);
    return tx.invoice.create({
      data: {
        userId,
        dealId: deal.id,
        number,
        subtotalIdr: deal.feeIdr,
        withholdingTaxType: validated.withholdingTaxType,
        status: "DRAFT",
        // A deal deadline is only inherited when it satisfies the due-date
        // contract, so an out-of-range legacy deadline never spreads into a
        // new invoice.
        dueDate: validated.dueDate ?? (deal.deadline && isSupportedStoredDueDate(deal.deadline) ? deal.deadline : null),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });
  });
}

export async function createInvoice(db: InvoiceCreateDb, userId: string, input: unknown) {
  const validated = invoiceCreateSchema.parse(input);

  const deal = await db.deal.findFirst({ where: { id: validated.dealId, userId } });
  if (!deal) return null;

  return insertInvoice(db, userId, deal, validated, null);
}

// #53: the invoice counterpart of createDealOnce. null when the deal is not
// the user's; a key already used for another deal or tax type throws
// IdempotencyConflictError.
export async function createInvoiceOnce(
  db: InvoiceCreateOnceDb,
  userId: string,
  input: unknown,
  idempotencyKey: string | null,
): Promise<CreateOnceResult<InvoiceRecord> | null> {
  const validated = invoiceCreateSchema.parse(input);

  const deal = await db.deal.findFirst({ where: { id: validated.dealId, userId } });
  if (!deal) return null;

  if (!idempotencyKey) return { record: await insertInvoice(db, userId, deal, validated, null), replayed: false };
  return createOnce(
    () => db.invoice.findFirst({ where: { userId, idempotencyKey } }),
    () => insertInvoice(db, userId, deal, validated, idempotencyKey),
    (stored) => stored.dealId === deal.id && stored.withholdingTaxType === validated.withholdingTaxType,
  );
}
