import { z } from "zod";

export const WITHHOLDING_TAX_TYPES = ["NONE", "PPH21", "PPH23"] as const;

export const invoiceCreateSchema = z.object({
  dealId: z.string().trim().min(1, "Deal wajib dipilih"),
  dueDate: z.coerce.date().optional(),
  withholdingTaxType: z.enum(WITHHOLDING_TAX_TYPES).default("NONE"),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
