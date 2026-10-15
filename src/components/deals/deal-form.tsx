import type { FormEvent } from "react";
import { fieldClassName } from "@/components/design-system";
import { formatMoney } from "@/lib/format/money";
import { DEAL_LIMITS } from "@/lib/deal-limits";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

export type DealFormState = {
  brand: string;
  contactWa: string;
  contactName: string;
  scope: string;
  feeIdr: string;
  deadline: string;
  paymentTerms: string;
};

export const EMPTY_DEAL_FORM: DealFormState = {
  brand: "",
  contactWa: "",
  contactName: "",
  scope: "",
  feeIdr: "",
  deadline: "",
  paymentTerms: "",
};

// Which fields are wrong, as the i18n key of each one's message.
export type DealFormErrors = Partial<Record<keyof DealFormState, string>>;

export const DEAL_FORM_FIELDS = Object.keys(EMPTY_DEAL_FORM) as Array<keyof DealFormState>;

function errorKey(field: keyof DealFormState) {
  return `dealForm.error.${field}`;
}

// The server's rules (deal-validation.ts) that the browser's own checks
// (required, maxLength, min/max/step) cannot express: text that is only
// spaces, and a WhatsApp number WhatsApp can open. Before this, those
// values reached the server and came back as one generic "could not be
// saved", with nothing saying which field or why (#50).
export function validateDealForm(form: DealFormState): DealFormErrors {
  const errors: DealFormErrors = {};
  if (form.brand.trim() === "") errors.brand = errorKey("brand");
  if (normalizeWhatsAppNumber(form.contactWa) === null) errors.contactWa = errorKey("contactWa");
  if (form.scope.trim() === "") errors.scope = errorKey("scope");
  const fee = Number(form.feeIdr);
  if (form.feeIdr.trim() === "" || !Number.isInteger(fee) || fee < 0 || fee > DEAL_LIMITS.feeIdrMax) {
    errors.feeIdr = errorKey("feeIdr");
  }
  return errors;
}

// The fields a 400 from POST /api/deals names, as the same messages. Names
// the form doesn't have are ignored.
export function dealFormErrorsFromServer(fields: unknown): DealFormErrors {
  const errors: DealFormErrors = {};
  if (!fields || typeof fields !== "object") return errors;
  for (const field of DEAL_FORM_FIELDS) {
    if (Object.hasOwn(fields, field)) errors[field] = errorKey(field);
  }
  return errors;
}

// What the form's fields hold on the page right now, as form state. Returns
// `current` itself when the page and the state already agree.
//
// The two differ in one case: /deal?tambah=1 arrives from the server with the
// dialog open, and someone typed before the page's scripts ran. The fields
// then hold text the state has never seen, and the first re-render would put
// every field back to the state's empty value (FIND-13).
export function readDealFormFields(formElement: HTMLFormElement, current: DealFormState): DealFormState {
  let next = current;
  for (const name of Object.keys(EMPTY_DEAL_FORM) as Array<keyof DealFormState>) {
    const field = formElement.elements.namedItem(name);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) continue;
    if (field.value !== current[name]) next = { ...next, [name]: field.value };
  }
  return next;
}

export function DealForm({
  formId,
  form,
  errors = {},
  onChange,
  onSubmit,
  isSaving,
  t,
  brandInputRef,
  formRef,
}: {
  formId: string;
  form: DealFormState;
  errors?: DealFormErrors;
  onChange: (next: DealFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  t: (key: string, values?: Record<string, string>) => string;
  brandInputRef?: React.RefObject<HTMLInputElement | null>;
  formRef?: React.RefObject<HTMLFormElement | null>;
}) {
  function fieldProps(name: keyof DealFormState) {
    const invalid = Boolean(errors[name]);
    return {
      name,
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${formId}-${name}-error` : undefined,
    };
  }

  function fieldError(name: keyof DealFormState) {
    const key = errors[name];
    return key ? (
      <span id={`${formId}-${name}-error`} className="text-[12px] font-normal text-overdue">
        {t(key)}
      </span>
    ) : null;
  }

  function invalidClass(name: keyof DealFormState) {
    return errors[name] ? " border-overdue" : "";
  }

  return (
    <form ref={formRef} id={formId} className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("dashboard.brand")}
          <input
            ref={brandInputRef}
            required
            {...fieldProps("brand")}
            maxLength={DEAL_LIMITS.brand}
            value={form.brand}
            onChange={(event) => onChange({ ...form, brand: event.target.value })}
            className={`${fieldClassName}${invalidClass("brand")}`}
          />
        </label>
        {fieldError("brand")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("dashboard.whatsapp")}
          <input
            required
            {...fieldProps("contactWa")}
            maxLength={DEAL_LIMITS.contactWa}
            inputMode="tel"
            value={form.contactWa}
            onChange={(event) => onChange({ ...form, contactWa: event.target.value })}
            className={`${fieldClassName}${invalidClass("contactWa")}`}
          />
        </label>
        {fieldError("contactWa")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("dashboard.contactName")}
          <input
            {...fieldProps("contactName")}
            maxLength={DEAL_LIMITS.contactName}
            value={form.contactName}
            onChange={(event) => onChange({ ...form, contactName: event.target.value })}
            className={`${fieldClassName}${invalidClass("contactName")}`}
          />
        </label>
        {fieldError("contactName")}
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("dashboard.scope")}
          <textarea
            required
            {...fieldProps("scope")}
            maxLength={DEAL_LIMITS.scope}
            value={form.scope}
            onChange={(event) => onChange({ ...form, scope: event.target.value })}
            className={`min-h-20 rounded-xl border border-line bg-bg px-3 py-2 text-[15px] font-normal outline-none focus:border-primary${invalidClass("scope")}`}
          />
        </label>
        {fieldError("scope")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("dashboard.fee")}
          <input
            required
            min="0"
            {...fieldProps("feeIdr")}
            max={DEAL_LIMITS.feeIdrMax}
            type="number"
            inputMode="numeric"
            value={form.feeIdr}
            onChange={(event) => onChange({ ...form, feeIdr: event.target.value })}
            className={`${fieldClassName}${invalidClass("feeIdr")}`}
          />
          {form.feeIdr && Number.isFinite(Number(form.feeIdr)) && Number(form.feeIdr) > 0 ? (
            <span className="text-[12px] font-normal text-muted">
              {t("dashboard.feePreview", { amount: formatMoney(Number(form.feeIdr)) })}
            </span>
          ) : null}
        </label>
        {fieldError("feeIdr")}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("dashboard.deadline")}
          <input
            {...fieldProps("deadline")}
            type="date"
            value={form.deadline}
            onChange={(event) => onChange({ ...form, deadline: event.target.value })}
            className={`${fieldClassName}${invalidClass("deadline")}`}
          />
        </label>
        {fieldError("deadline")}
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
          {t("dashboard.paymentTerms")}
          <input
            {...fieldProps("paymentTerms")}
            maxLength={DEAL_LIMITS.paymentTerms}
            value={form.paymentTerms}
            onChange={(event) => onChange({ ...form, paymentTerms: event.target.value })}
            className={`${fieldClassName}${invalidClass("paymentTerms")}`}
          />
        </label>
        {fieldError("paymentTerms")}
      </div>
      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:w-fit"
      >
        {isSaving ? t("dashboard.saving") : t("dashboard.saveDeal")}
      </button>
    </form>
  );
}
