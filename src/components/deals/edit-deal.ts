import type { DealRecord } from "@/lib/deals";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import type { DealFormState } from "./deal-form";

// #55: editing a saved deal with the create form (deal-form.tsx). These are
// the pure parts: the form a deal starts from, the PATCH a form sends, and
// whether a deal read back from the server holds that PATCH.

// A date-only value as the form's <input type="date"> holds it. Deadlines are
// stored as UTC midnight of the chosen day (z.coerce.date("YYYY-MM-DD")), so
// the UTC date is the day the person picked.
export function toDateInputValue(value: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function dealToForm(deal: DealRecord): DealFormState {
  return {
    brand: deal.brand,
    contactWa: deal.contactWa,
    contactName: deal.contactName ?? "",
    scope: deal.scope,
    feeIdr: String(deal.feeIdr),
    deadline: toDateInputValue(deal.deadline),
    paymentTerms: deal.paymentTerms ?? "",
  };
}

export type DealPatchBody = {
  brand?: string;
  contactWa?: string;
  contactName?: string | null;
  scope?: string;
  feeIdr?: number;
  deadline?: string | null;
  paymentTerms?: string | null;
};

function blankToNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

// Only the fields the person changed, and never `status`: an edit does not
// move the deal (FIND-10) and adds no stage history. An emptied optional
// field is sent as null, which clears it; an untouched one is left out,
// which leaves it alone (FIND-11).
export function buildDealPatch(initial: DealFormState, form: DealFormState): DealPatchBody {
  const patch: DealPatchBody = {};
  if (form.brand !== initial.brand) patch.brand = form.brand;
  if (form.contactWa !== initial.contactWa) patch.contactWa = form.contactWa;
  if (form.contactName !== initial.contactName) patch.contactName = blankToNull(form.contactName);
  if (form.scope !== initial.scope) patch.scope = form.scope;
  if (form.feeIdr !== initial.feeIdr) patch.feeIdr = Number(form.feeIdr);
  if (form.deadline !== initial.deadline) patch.deadline = form.deadline === "" ? null : form.deadline;
  if (form.paymentTerms !== initial.paymentTerms) patch.paymentTerms = blankToNull(form.paymentTerms);
  return patch;
}

// Whether `deal`, as the server stores it now, holds every field of `patch`
// -- applying the server's own normalization (trimming, WhatsApp number
// format). Used to confirm a save by reading it back, and to settle a save
// whose answer never arrived.
export function dealHoldsPatch(deal: DealRecord, patch: DealPatchBody): boolean {
  if (patch.brand !== undefined && deal.brand !== patch.brand.trim()) return false;
  if (patch.contactWa !== undefined && deal.contactWa !== (normalizeWhatsAppNumber(patch.contactWa) ?? patch.contactWa.trim())) return false;
  if (patch.contactName !== undefined && (deal.contactName ?? null) !== (patch.contactName?.trim() || null)) return false;
  if (patch.scope !== undefined && deal.scope !== patch.scope.trim()) return false;
  if (patch.feeIdr !== undefined && deal.feeIdr !== patch.feeIdr) return false;
  if (patch.deadline !== undefined && toDateInputValue(deal.deadline) !== (patch.deadline ?? "")) return false;
  if (patch.paymentTerms !== undefined && (deal.paymentTerms ?? null) !== (patch.paymentTerms?.trim() || null)) return false;
  return true;
}
