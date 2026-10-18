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
  // A number, or digits as text (a form field). z.coerce.number() alone took
  // null, "" and false as 0, so a fee could be wiped to Rp 0 by accident.
  feeIdr: z
    .union([z.number(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().int().min(0).max(DEAL_LIMITS.feeIdrMax)),
  deadline: z.coerce.date().optional(),
  paymentTerms: z.string().trim().max(DEAL_LIMITS.paymentTerms).optional(),
  status: z.enum(DEAL_STATUSES).default("MASUK"),
});

// An optional text field a patch can clear: null, or text that is empty
// once trimmed, stores null.
function clearableText(max: number) {
  return z.union([z.null(), z.string().trim().max(max)]).transform((value) => (value === "" ? null : value));
}

// A patch changes only what it names. partial() alone keeps the create
// schema's `status` default, so a patch without a status (a contact name, a
// repaired WhatsApp number) came back with status "MASUK" and moved the deal
// to the first stage (FIND-10). Here status has no default.
//
// Omitted means unchanged; clearing an optional field is explicit: null (or
// blank text) for the contact name, the payment terms and the deadline.
// Before, a cleared contact name could only be sent as "omitted", so the
// save changed nothing and still reported success (FIND-11).
export const dealPatchSchema = dealInputSchema
  .extend({
    status: z.enum(DEAL_STATUSES),
    contactName: clearableText(DEAL_LIMITS.contactName),
    paymentTerms: clearableText(DEAL_LIMITS.paymentTerms),
    // null before coerce: z.coerce.date() would turn null into 1970-01-01.
    deadline: z.union([z.null(), z.coerce.date()]),
  })
  .partial();

export type DealInput = z.infer<typeof dealInputSchema>;
export type DealPatch = z.infer<typeof dealPatchSchema>;
