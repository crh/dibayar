import { Prisma } from "@/generated/prisma/client";
import { dealInputSchema, dealPatchSchema, type DealInput, type DealPatch } from "./deal-validation";

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
  createdAt: Date;
  updatedAt: Date;
};

type DealCreateData = Omit<DealRecord, "id" | "createdAt" | "updatedAt">;

type DealModel = {
  findMany(args: {
    where: { userId: string };
    orderBy: Array<Record<string, "asc" | "desc">>;
  }): Promise<DealRecord[]>;
  findFirst(args: { where: { id: string; userId: string } }): Promise<DealRecord | null>;
  create(args: { data: DealCreateData }): Promise<DealRecord>;
  update(args: { where: { id: string }; data: Partial<DealCreateData> }): Promise<DealRecord>;
  delete(args: { where: { id: string } }): Promise<DealRecord>;
};

// T-17: a durable, best-effort audit trail of pipeline moves, written
// alongside (not inside the same transaction as) the Deal row -- see
// recordDealStageTransition. fromStatus is null only for the entry
// recorded at deal creation.
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

export type DealDb = { deal: DealModel; dealStageTransition: DealStageTransitionModel };

function toCreateData(userId: string, input: DealInput): DealCreateData {
  return {
    userId,
    brand: input.brand,
    contactWa: input.contactWa,
    contactName: input.contactName ?? null,
    scope: input.scope,
    feeIdr: input.feeIdr,
    deadline: input.deadline ?? null,
    paymentTerms: input.paymentTerms ?? null,
    status: input.status,
  };
}

async function recordDealStageTransition(
  db: DealDb,
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
  if (input.deadline !== undefined) data.deadline = input.deadline;
  return data;
}

export async function listDeals(db: DealDb, userId: string) {
  return db.deal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
  });
}

export async function createDeal(db: DealDb, userId: string, input: unknown) {
  const validated = dealInputSchema.parse(input);
  const deal = await db.deal.create({ data: toCreateData(userId, validated) });
  await recordDealStageTransition(db, deal.id, null, deal.status);
  return deal;
}

export async function getOwnedDeal(db: DealDb, id: string, userId: string) {
  return db.deal.findFirst({ where: { id, userId } });
}

export async function updateDeal(
  db: DealDb,
  id: string,
  userId: string,
  input: unknown,
) {
  const existing = await getOwnedDeal(db, id, userId);
  if (!existing) return null;
  // Snapshot as a primitive: db.deal.update below may mutate `existing` in
  // place depending on the underlying implementation, and a string can't be
  // affected by that the way a shared object reference could be.
  const previousStatus = existing.status;
  const validated = dealPatchSchema.parse(input);
  const deal = await db.deal.update({ where: { id }, data: toPatchData(validated) });
  if (validated.status !== undefined && validated.status !== previousStatus) {
    await recordDealStageTransition(db, id, previousStatus, validated.status);
  }
  return deal;
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
    await db.deal.delete({ where: { id } });
    return { kind: "deleted" };
  } catch (error) {
    if (isInvoiceForeignKeyRestriction(error)) return { kind: "has-invoices" };
    throw error;
  }
}
