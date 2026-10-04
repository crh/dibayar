import { z } from "zod";
import { checkDueDateInput, dueDateInputToStoredDate } from "./due-date";

export const WITHHOLDING_TAX_TYPES = ["NONE", "PPH21", "PPH23"] as const;
export const INVOICE_STATUSES = ["DRAFT", "SENT", "DUE", "OVERDUE", "PAID"] as const;

// A due date must arrive as a strict yyyy-mm-dd string naming a real
// calendar day inside the supported range (see src/lib/due-date.ts). No
// z.coerce.date(): that silently accepted year 0002, timestamps, and epoch
// numbers, and normalized impossible days (FIND-03).
const dueDateInputSchema = z
  .string()
  .refine((value) => checkDueDateInput(value).kind === "valid", "Tanggal jatuh tempo tidak valid")
  .transform(dueDateInputToStoredDate);

export const invoiceCreateSchema = z.object({
  dealId: z.string().trim().min(1, "Deal wajib dipilih"),
  dueDate: dueDateInputSchema.optional(),
  withholdingTaxType: z.enum(WITHHOLDING_TAX_TYPES).default("NONE"),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export const invoiceStatusUpdateSchema = z.object({
  status: z.enum(INVOICE_STATUSES),
});

export type InvoiceStatusUpdateInput = z.infer<typeof invoiceStatusUpdateSchema>;

// dueDate is nullable (not just optional) so the owner can explicitly clear a
// previously set date; the string checks only run when the value isn't null.
export const invoiceDueDateUpdateSchema = z.object({
  dueDate: dueDateInputSchema.nullable(),
});

export type InvoiceDueDateUpdateInput = z.infer<typeof invoiceDueDateUpdateSchema>;
