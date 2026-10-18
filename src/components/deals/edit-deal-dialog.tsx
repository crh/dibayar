"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DealRecord } from "@/lib/deals";
import { bodyField, mutationErrorKey, sendMutation } from "@/lib/mutation";
import { AddDealDialog } from "./add-deal-dialog";
import {
  DEAL_FORM_FIELDS,
  DealForm,
  dealFormErrorsFromServer,
  validateDealForm,
  type DealFormErrors,
  type DealFormState,
} from "./deal-form";
import { buildDealPatch, dealHoldsPatch, dealToForm } from "./edit-deal";

// #55: edit a saved deal's brand, contact, scope, fee, deadline and payment
// terms, from the board card's menu or from deal detail. Same form and
// client-side rules as creating one (deal-form.tsx); the server applies
// dealPatchSchema again.
//
// What it sends: PATCH /api/deals/:id with the changed fields only, never a
// status (the stage and its history stay as they are). A save counts only
// once the deal read back from the server holds the change -- there is no
// optimistic success. A save whose answer never arrived is settled the same
// way: read back, and either confirmed or reported as unknown, never
// guessed. Repeating a PATCH with the same values is harmless, and the save
// button is disabled while one is in flight.
//
// An invoice is never touched from here (Decision A, CAP-INV-12): its
// number, amount, PPh and due date are its own, and a sent or shared one is
// frozen. The note says so when the deal has an invoice.

type Props = {
  deal: DealRecord;
  open: boolean;
  invoiceNumber?: string | null;
  t: (key: string, values?: Record<string, string>) => string;
  onClose: () => void;
  onSaved: (deal: DealRecord) => void;
};

async function readBack(dealId: string): Promise<DealRecord | undefined> {
  const result = await sendMutation(`/api/deals/${dealId}`, { cache: "no-store" });
  return result.kind === "ok" ? bodyField<DealRecord>(result.body, "deal") : undefined;
}

export function EditDealDialog(props: Props) {
  // Mounted only while open, so every opening starts from the deal as it is
  // now rather than from an earlier, abandoned edit.
  if (!props.open) return null;
  return <EditDealDialogContent {...props} />;
}

function EditDealDialogContent({ deal, invoiceNumber, t, onClose, onSaved }: Props) {
  const formId = `ubah-deal-${deal.id}`;
  const [initial] = useState(() => dealToForm(deal));
  const [form, setForm] = useState<DealFormState>(initial);
  const [fieldErrors, setFieldErrors] = useState<DealFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const isDirty = Object.keys(buildDealPatch(initial, form)).length > 0;

  useEffect(() => {
    if (confirmingDiscard) keepEditingRef.current?.focus();
  }, [confirmingDiscard]);

  // Close, Escape, the backdrop and Batal all come here: unsaved changes are
  // never dropped without asking. While a save is in flight the dialog stays
  // open, so its outcome is not lost.
  function requestClose() {
    if (isSaving) return;
    if (confirmingDiscard) {
      setConfirmingDiscard(false);
      return;
    }
    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  function showFieldErrors(errors: DealFormErrors) {
    setFieldErrors(errors);
    setError("dealForm.checkFields");
    const first = DEAL_FORM_FIELDS.find((field) => errors[field]);
    const element = first ? formRef.current?.elements.namedItem(first) : null;
    if (element instanceof HTMLElement) element.focus();
  }

  function handleChange(next: DealFormState) {
    const corrected = DEAL_FORM_FIELDS.filter((field) => fieldErrors[field] && next[field] !== form[field]);
    if (corrected.length > 0) {
      const remaining = { ...fieldErrors };
      for (const field of corrected) delete remaining[field];
      setFieldErrors(remaining);
      if (Object.keys(remaining).length === 0 && error === "dealForm.checkFields") setError(null);
    }
    setForm(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);

    const errors = validateDealForm(form);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const patch = buildDealPatch(initial, form);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const result = await sendMutation(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (result.kind === "rejected") {
        const serverErrors = result.status === 400 ? dealFormErrorsFromServer(bodyField(result.body, "fields")) : {};
        if (Object.keys(serverErrors).length > 0) showFieldErrors(serverErrors);
        else setError(result.status === 404 ? "deal.editNotFound" : mutationErrorKey(result, "deal.editError"));
        return;
      }

      // "ok", or no answer: either way the server's copy decides.
      const stored = await readBack(deal.id);
      if (stored && dealHoldsPatch(stored, patch)) {
        onSaved(stored);
        return;
      }
      setError(result.kind === "ok" ? "deal.editUnconfirmed" : "error.connection");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AddDealDialog
      open
      onClose={requestClose}
      title={t("deal.editTitle")}
      description={t("deal.editHint")}
      closeLabel={t("dashboard.close")}
    >
      {confirmingDiscard ? (
        // Shown instead of the form, not above it: while the question is open
        // the only things to tab to are its two answers and the dialog's own
        // close button (which, like Escape, means "keep editing").
        <div role="alertdialog" aria-labelledby={`${formId}-discard`} className="rounded-xl border border-due bg-due-tint p-4">
          <p id={`${formId}-discard`} className="text-[14px] font-semibold text-ink">{t("deal.editDiscardTitle")}</p>
          <div className="mt-3 flex flex-col gap-2 min-[360px]:flex-row">
            <button
              ref={keepEditingRef}
              type="button"
              onClick={() => setConfirmingDiscard(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface px-4 text-[14px] font-semibold text-ink"
            >
              {t("deal.editDiscardKeep")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-full bg-overdue px-4 text-[14px] font-semibold text-surface"
            >
              {t("deal.editDiscardConfirm")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {invoiceNumber ? (
            <p role="note" className="mb-4 rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink">
              {t("deal.editInvoiceNote", { number: invoiceNumber })}
            </p>
          ) : null}
          {error ? <p role="alert" className="mb-3 ds-small text-overdue">{t(error)}</p> : null}
          <DealForm
            formId={formId}
            formRef={formRef}
            form={form}
            errors={fieldErrors}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            t={t}
            submitLabel={t("deal.editSave")}
            secondaryAction={
              <button
                type="button"
                onClick={requestClose}
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-[15px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60 sm:w-fit"
              >
                {t("deal.editCancel")}
              </button>
            }
          />
        </>
      )}
    </AddDealDialog>
  );
}
