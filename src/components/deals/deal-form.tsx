import type { FormEvent } from "react";
import { fieldClassName } from "@/components/design-system";
import { formatMoney } from "@/lib/format/money";

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

export function DealForm({
  formId,
  form,
  onChange,
  onSubmit,
  isSaving,
  t,
  brandInputRef,
}: {
  formId: string;
  form: DealFormState;
  onChange: (next: DealFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  t: (key: string, values?: Record<string, string>) => string;
  brandInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <form id={formId} className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
        {t("dashboard.brand")}
        <input
          ref={brandInputRef}
          required
          name="brand"
          value={form.brand}
          onChange={(event) => onChange({ ...form, brand: event.target.value })}
          className={fieldClassName}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
        {t("dashboard.whatsapp")}
        <input
          required
          name="contactWa"
          inputMode="tel"
          value={form.contactWa}
          onChange={(event) => onChange({ ...form, contactWa: event.target.value })}
          className={fieldClassName}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
        {t("dashboard.contactName")}
        <input
          name="contactName"
          value={form.contactName}
          onChange={(event) => onChange({ ...form, contactName: event.target.value })}
          className={fieldClassName}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink sm:col-span-2">
        {t("dashboard.scope")}
        <textarea
          required
          name="scope"
          value={form.scope}
          onChange={(event) => onChange({ ...form, scope: event.target.value })}
          className="min-h-20 rounded-xl border border-line bg-bg px-3 py-2 text-[15px] font-normal outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
        {t("dashboard.fee")}
        <input
          required
          min="0"
          name="feeIdr"
          type="number"
          inputMode="numeric"
          value={form.feeIdr}
          onChange={(event) => onChange({ ...form, feeIdr: event.target.value })}
          className={fieldClassName}
        />
        {form.feeIdr && Number.isFinite(Number(form.feeIdr)) && Number(form.feeIdr) > 0 ? (
          <span className="text-[12px] font-normal text-muted">
            {t("dashboard.feePreview", { amount: formatMoney(Number(form.feeIdr)) })}
          </span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
        {t("dashboard.deadline")}
        <input
          name="deadline"
          type="date"
          value={form.deadline}
          onChange={(event) => onChange({ ...form, deadline: event.target.value })}
          className={fieldClassName}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink sm:col-span-2">
        {t("dashboard.paymentTerms")}
        <input
          name="paymentTerms"
          value={form.paymentTerms}
          onChange={(event) => onChange({ ...form, paymentTerms: event.target.value })}
          className={fieldClassName}
        />
      </label>
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
