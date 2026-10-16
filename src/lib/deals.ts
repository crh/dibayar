import { Prisma } from "@/generated/prisma/client";
import { dealInputSchema, dealPatchSchema, type DealInput, type DealPatch } from "./deal-validation";
import { createOnce, type CreateOnceResult } from "./idempotency";
import { normalizeWhatsAppNumber } from "./whatsapp";

export type DealStatus = DealInput["status"];

export type DealRecord = {
  id: string;
  userId: string;
  brand: string;
  contactWa: string;
  contactName: string | null;
  scope: string;
  feeIdr: number;
  deadline: Date | null;
  paymentTerms: string | null;
  status: DealStatus;
  // See createDealOnce. Optional here: no client code reads it.
  idempotencyKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DealCreateData = Omit<DealRecord, "id" | "createdAt" | "updatedAt">;

type DealModel = {
  findMany(args: {
    where: { userId: string };
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<DealRecord[]>;
  findFirst(args: {
    where: { id: string; userId: string } | { userId: string; idempotencyKey: string };
  }): Promise<DealRecord | null>;
  create(args: { data: DealCreateData }): Promise<DealRecord>;
  update(args: { where: { id: string; userId: string }; data: Partial<DealCreateData> }): Promise<DealRecord>;
  delete(args: { where: { id: string; userId: string } }): Promise<DealRecord>;
};

// T-17: a durable audit trail of pipeline moves, written inside the same
// transaction as the Deal row it describes -- see recordDealStageTransition.
// fromStatus is null only for the entry recorded at deal creation.
export type DealStageTransitionRecord = {
  id: string;
  dealId: string;
  fromStatus: DealStatus | null;
  toStatus: DealStatus;
  createdAt: Date;
};

type DealStageTransitionModel = {
  create(args: {
    data: { dealId: string; fromStatus: DealStatus | null; toStatus: DealStatus };
  }): Promise<DealStageTransitionRecord>;
  findMany(args: {
    where: { dealId: string };
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<DealStageTransitionRecord[]>;
};

// The model delegates alone -- this is what Prisma's interactive transaction
// client actually exposes. It does not include $transaction: Prisma does not
// support starting a transaction from within one.
export type DealClient = {
  deal: DealModel;
  dealStageTransition: DealStageTransitionModel;
};

export type DealDb = DealClient & {
  $transaction<T>(fn: (tx: DealClient) => Promise<T>): Promise<T>;
};

function toCreateData(userId: string, input: DealInput, idempotencyKey: string | null = null): DealCreateData {
  return {
    userId,
    brand: input.brand,
    contactWa: normalizeWhatsAppNumber(input.contactWa) ?? input.contactWa,
    contactName: input.contactName ?? null,
    scope: input.scope,
    feeIdr: input.feeIdr,
    deadline: input.deadline ?? null,
    paymentTerms: input.paymentTerms ?? null,
    status: input.status,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

async function recordDealStageTransition(
  db: DealClient,
  dealId: string,
  fromStatus: DealStatus | null,
  toStatus: DealStatus,
) {
  await db.dealStageTransition.create({ data: { dealId, fromStatus, toStatus } });
}

export async function listDealStageTransitions(db: DealDb, dealId: string) {
  return db.dealStageTransition.findMany({
    where: { dealId },
    orderBy: [{ createdAt: "desc" }],
  });
}

function toPatchData(input: DealPatch): Partial<DealCreateData> {
  const data: Partial<DealCreateData> = { ...input };
  if (input.contactWa !== undefined) data.contactWa = normalizeWhatsAppNumber(input.contactWa) ?? input.contactWa;
  if (input.deadline !== undefined) data.deadline = input.deadline;
  return data;
}

export async function listDeals(db: DealDb, userId: string) {
  return db.deal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
  });
}

async function insertDeal(db: DealDb, userId: string, validated: DealInput, idempotencyKey: string | null) {
  return db.$transaction(async (tx) => {
    const deal = await tx.deal.create({ data: toCreateData(userId, validated, idempotencyKey) });
    await recordDealStageTransition(tx, deal.id, null, deal.status);
    return deal;
  });
}

export async function createDeal(db: DealDb, userId: string, input: unknown) {
  return insertDeal(db, userId, dealInputSchema.parse(input), null);
}

// The stored deal is the same submission when every field the person typed
// matches. The stage is left out: it can be moved before a late repeat.
function isSameDealSubmission(stored: DealRecord, sent: DealCreateData) {
  return (
    stored.brand === sent.brand &&
    stored.contactWa === sent.contactWa &&
    stored.contactName === sent.contactName &&
    stored.scope === sent.scope &&
    stored.feeIdr === sent.feeIdr &&
    (stored.deadline?.getTime() ?? null) === (sent.deadline?.getTime() ?? null) &&
    stored.paymentTerms === sent.paymentTerms
  );
}

// #53: a create the page may repeat after an unknown outcome. With a key, a
// repeat returns the deal the first request stored (see createOnce); a key
// already used for different content throws IdempotencyConflictError.
export async function createDealOnce(
  db: DealDb,
  userId: string,
  input: unknown,
  idempotencyKey: string | null,
): Promise<CreateOnceResult<DealRecord>> {
  const validated = dealInputSchema.parse(input);
  if (!idempotencyKey) return { record: await insertDeal(db, userId, validated, null), replayed: false };
  const sent = toCreateData(userId, validated);
  return createOnce(
    () => db.deal.findFirst({ where: { userId, idempotencyKey } }),
    () => insertDeal(db, userId, validated, idempotencyKey),
    (stored) => isSameDealSubmission(stored, sent),
  );
}

export async function getOwnedDeal(db: DealClient, id: string, userId: string) {
  return db.deal.findFirst({ where: { id, userId } });
}

export async function updateDeal(
  db: DealDb,
  id: string,
  userId: string,
  input: unknown,
) {
  const validated = dealPatchSchema.parse(input);
  return db.$transaction(async (tx) => {
    // The owner-scoped read happens inside this transaction, not before it,
    // so fromStatus below reflects the row as of this transaction's own
    // snapshot rather than a stale read taken before it started.
    const existing = await getOwnedDeal(tx, id, userId);
    if (!existing) return null;
    // Snapshot as a primitive: tx.deal.update below may mutate `existing` in
    // place depending on the underlying implementation, and a string can't be
    // affected by that the way a shared object reference could be.
    const previousStatus = existing.status;
    const deal = await tx.deal.update({ where: { id, userId }, data: toPatchData(validated) });
    if (validated.status !== undefined && validated.status !== previousStatus) {
      await recordDealStageTransition(tx, id, previousStatus, validated.status);
    }
    return deal;
  });
}

export type DeleteDealResult =
  | { kind: "deleted" }
  | { kind: "not-found" }
  | { kind: "has-invoices" };

// Deal.invoices carries the only FK restricting Deal deletion, so P2003 here is unambiguous.
function isInvoiceForeignKeyRestriction(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export async function deleteDeal(db: DealDb, id: string, userId: string): Promise<DeleteDealResult> {
  if (!(await getOwnedDeal(db, id, userId))) return { kind: "not-found" };

  try {
    await db.deal.delete({ where: { id, userId } });
    return { kind: "deleted" };
  } catch (error) {
    if (isInvoiceForeignKeyRestriction(error)) return { kind: "has-invoices" };
    throw error;
  }
}
