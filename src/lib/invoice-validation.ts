import { z } from "zod";

export const WITHHOLDING_TAX_TYPES = ["NONE", "PPH21", "PPH23"] as const;
export const INVOICE_STATUSES = ["DRAFT", "SENT", "DUE", "OVERDUE", "PAID"] as const;

export const invoiceCreateSchema = z.object({
  dealId: z.string().trim().min(1, "Deal wajib dipilih"),
  dueDate: z.coerce.date().optional(),
  withholdingTaxType: z.enum(WITHHOLDING_TAX_TYPES).default("NONE"),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(INVOICE_STATUSES),
});

export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>;

// dueDate is nullable (not just optional) so the owner can explicitly clear a
// previously set date; z.coerce.date() only runs when the value isn't null.
export const invoiceDueDateUpdateSchema = z.object({
  dueDate: z.coerce.date().nullable(),
});

export type InvoiceDueDateUpdateInput = z.infer<typeof invoiceDueDateUpdateSchema>;
