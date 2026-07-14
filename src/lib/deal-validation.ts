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
  scope: z.string().trim().min(1, "Scope deal wajib diisi").max(500),
  feeIdr: z.coerce.number().int().min(0).max(10_000_000_000),
  deadline: z.coerce.date().optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  status: z.enum(DEAL_STATUSES).default("MASUK"),
});

export const dealPatchSchema = dealInputSchema.partial();

export type DealInput = z.infer<typeof dealInputSchema>;
export type DealPatch = z.infer<typeof dealPatchSchema>;
