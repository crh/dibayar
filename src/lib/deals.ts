import { dealInputSchema, dealPatchSchema, type DealInput, type DealPatch } from "./deal-validation";

export type DealStatus = DealInput["status"];

export type DealRecord = {
  id: string;
  userId: string;
  brand: string;
  contactWa: string;
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
  findUnique(args: { where: { id: string } }): Promise<DealRecord | null>;
  create(args: { data: DealCreateData }): Promise<DealRecord>;
  update(args: { where: { id: string }; data: Partial<DealCreateData> }): Promise<DealRecord>;
  delete(args: { where: { id: string } }): Promise<DealRecord>;
};

export type DealDb = { deal: DealModel };

function toCreateData(userId: string, input: DealInput): DealCreateData {
  return {
    userId,
    brand: input.brand,
    contactWa: input.contactWa,
    scope: input.scope,
    feeIdr: input.feeIdr,
    deadline: input.deadline ?? null,
    paymentTerms: input.paymentTerms ?? null,
    status: input.status,
  };
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
  return db.deal.create({ data: toCreateData(userId, validated) });
}

export async function getOwnedDeal(db: DealDb, id: string, userId: string) {
  const deal = await db.deal.findUnique({ where: { id } });
  return deal?.userId === userId ? deal : null;
}

export async function updateDeal(
  db: DealDb,
  id: string,
  userId: string,
  input: unknown,
) {
  if (!(await getOwnedDeal(db, id, userId))) return null;
  const validated = dealPatchSchema.parse(input);
  return db.deal.update({ where: { id }, data: toPatchData(validated) });
}

export async function deleteDeal(db: DealDb, id: string, userId: string) {
  if (!(await getOwnedDeal(db, id, userId))) return false;
  await db.deal.delete({ where: { id } });
  return true;
}
