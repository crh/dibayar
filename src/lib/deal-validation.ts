import { z } from "zod";
import { DEAL_LIMITS } from "./deal-limits";
import { normalizeWhatsAppNumber } from "./whatsapp";

export const DEAL_STATUSES = [
  "MASUK",
  "NEGO",
  "DEAL",
  "KONTEN",
  "INVOICE",
  "DIBAYAR",
] as const;

export const dealInputSchema = z.object({
  brand: z.string().trim().min(1, "Nama brand wajib diisi").max(DEAL_LIMITS.brand),
  // The number has to be one WhatsApp can open (normalizeWhatsAppNumber:
  // 9-15 digits once normalized). A bare length check let "123456" through,
  // and the deal then could not be messaged until someone repaired it (#50).
  contactWa: z
    .string()
    .trim()
    .max(DEAL_LIMITS.contactWa)
    .refine((value) => normalizeWhatsAppNumber(value) !== null, "Nomor WhatsApp tidak valid"),
  contactName: z.string().trim().max(DEAL_LIMITS.contactName).optional(),
  scope: z.string().trim().min(1, "Scope deal wajib diisi").max(DEAL_LIMITS.scope),
  feeIdr: z.coerce.number().int().min(0).max(DEAL_LIMITS.feeIdrMax),
  deadline: z.coerce.date().optional(),
  paymentTerms: z.string().trim().max(DEAL_LIMITS.paymentTerms).optional(),
  status: z.enum(DEAL_STATUSES).default("MASUK"),
});

// A patch changes only what it names. partial() alone keeps the create
// schema's `status` default, so a patch without a status (a contact name, a
// repaired WhatsApp number) came back with status "MASUK" and moved the deal
// to the first stage (FIND-10). Here status has no default.
export const dealPatchSchema = dealInputSchema.extend({ status: z.enum(DEAL_STATUSES) }).partial();

export type DealInput = z.infer<typeof dealInputSchema>;
export type DealPatch = z.infer<typeof dealPatchSchema>;
