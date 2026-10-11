import { z } from "zod";

export const DEAL_STATUSES = [
  "MASUK",
  "NEGO",
  "DEAL",
  "KONTEN",
  "INVOICE",
  "DIBAYAR",
] as const;

export const dealInputSchema = z.object({
  brand: z.string().trim().min(1, "Nama brand wajib diisi").max(120),
  contactWa: z.string().trim().min(6, "Nomor WhatsApp tidak valid").max(32),
  contactName: z.string().trim().max(120).optional(),
  scope: z.string().trim().min(1, "Scope deal wajib diisi").max(500),
  feeIdr: z.coerce.number().int().min(0).max(10_000_000_000),
  deadline: z.coerce.date().optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  status: z.enum(DEAL_STATUSES).default("MASUK"),
});

// A patch changes only what it names. partial() alone keeps the create
// schema's `status` default, so a patch without a status (a contact name, a
// repaired WhatsApp number) came back with status "MASUK" and moved the deal
// to the first stage (FIND-10). Here status has no default.
export const dealPatchSchema = dealInputSchema.extend({ status: z.enum(DEAL_STATUSES) }).partial();

export type DealInput = z.infer<typeof dealInputSchema>;
export type DealPatch = z.infer<typeof dealPatchSchema>;
