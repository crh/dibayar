"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";
import { Button, fieldClassName } from "@/components/design-system";
import { fetchWithTimeout } from "@/lib/http";
import type { UserSettingsView } from "@/lib/user-settings";
import { SETTINGS_LIMITS } from "@/lib/user-settings-limits";
import type { Language } from "@/lib/i18n";

const TEMPLATE_TOKENS = ["{brand}", "{jumlah}", "{jatuh_tempo}", "{nomor_invoice}", "{tautan}"];

const REQUIRED_FIELDS = ["issuerName", "bankName", "bankAccountNumber", "bankAccountHolder"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

type FormState = {
  issuerName: string;
  issuerAddress: string;
  issuerWhatsapp: string;
  issuerEmail: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  templateSend: string;
  templateChase: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toFormState(settings: UserSettingsView): FormState {
  return {
    issuerName: settings.issuerName,
    issuerAddress: settings.issuerAddress,
    issuerWhatsapp: settings.issuerWhatsapp,
    issuerEmail: settings.issuerEmail,
    bankName: settings.bankName,
    bankAccountNumber: settings.bankAccountNumber,
    bankAccountHolder: settings.bankAccountHolder,
    templateSend: settings.templateSend,
    templateChase: settings.templateChase,
  };
}

// Drives the persistent "complete your identity/bank details" notice, which
// must reflect what is actually saved on the server, not unsaved keystrokes.
function hasIncompleteIssuer(settings: Pick<UserSettingsView, RequiredField>): boolean {
  return REQUIRED_FIELDS.some((field) => settings[field].trim() === "");
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

type FieldErrors = Partial<Record<keyof FormState, string>>;

export function SettingsForm({
  initialSettings,
  email,
}: {
  initialSettings: UserSettingsView;
  email?: string | null;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [saved, setSaved] = useState<UserSettingsView>(initialSettings);
  const [form, setForm] = useState<FormState>(() => toFormState(initialSettings));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [signOutConfirming, setSignOutConfirming] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(next: FormState): FieldErrors {
    const errors: FieldErrors = {};
    for (const field of REQUIRED_FIELDS) {
      if (next[field].trim() === "") errors[field] = t("settings.required");
    }
    if (next.issuerEmail.trim() !== "" && !EMAIL_PATTERN.test(next.issuerEmail.trim())) {
      errors.issuerEmail = t("settings.invalidEmail");
    }
    return errors;
  }

  function fieldErrorsFromServer(fields: unknown): FieldErrors {
    const errors: FieldErrors = {};
    if (!fields || typeof fields !== "object") return errors;
    for (const field of Object.keys(SETTINGS_LIMITS) as Array<keyof FormState>) {
      if (!Object.hasOwn(fields, field)) continue;
      errors[field] = field === "issuerEmail" ? t("settings.invalidEmail") : t("settings.fieldInvalid");
    }
    return errors;
  }

  async function persist(payload: FormState): Promise<boolean> {
    const errors = validate(payload);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    setFormError(null);
    setStatus("saving");
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);

    try {
      const response = await fetchWithTimeout("/api/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      const serverErrors = response.status === 400 ? fieldErrorsFromServer(body?.fields) : {};
      if (Object.keys(serverErrors).length > 0) {
        // Which field the server refused, rather than "couldn't save, try
        // again" (#50).
        setFieldErrors(serverErrors);
        setFormError(t("settings.checkFields"));
        setStatus("error");
        return false;
      }
      if (!response.ok) {
        setFormError(t("settings.saveError"));
        setStatus("error");
        return false;
      }

      const nextSettings = body.settings as UserSettingsView;
      setSaved(nextSettings);
      setForm(toFormState(nextSettings));
      setStatus("saved");
      savedTimeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
      return true;
    } catch {
      setFormError(t("settings.saveError"));
      setStatus("error");
      return false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    persist(form);
  }

  function resetTemplate(field: "templateSend" | "templateChase") {
    persist({ ...form, [field]: "" });
  }

  const showDependencyNotice = hasIncompleteIssuer(saved);
  const isSaving = status === "saving";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold text-ink">{t("nav.settings")}</h1>

      {showDependencyNotice ? (
        <div role="status" className="rounded-md border border-due bg-due-tint px-4 py-3 text-[14px] text-ink">
          {t("settings.dependencyNotice")}
        </div>
      ) : null}

      <section aria-labelledby="settings-language-heading" className="border-b border-line pb-8">
        <h2 id="settings-language-heading" className="text-[16px] font-bold text-ink">
          {t("settings.language.heading")}
        </h2>
        <p className="mt-1 text-[13px] text-muted">{t("settings.language.helper")}</p>
        <div
          role="group"
          aria-label={t("settings.language.heading")}
          className="mt-3 inline-flex rounded-full border border-line p-1"
        >
          {(["id", "en"] satisfies Language[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={language === option}
              onClick={() => setLanguage(option)}
              className={`h-11 min-w-[96px] rounded-full px-4 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                language === option ? "bg-primary text-surface" : "text-ink"
              }`}
            >
              {t(option === "id" ? "settings.language.optionIndonesian" : "settings.language.optionEnglish")}
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        <section aria-labelledby="settings-issuer-heading" className="border-b border-line pb-8">
          <h2 id="settings-issuer-heading" className="text-[16px] font-bold text-ink">
            {t("settings.issuer.heading")}
          </h2>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              {t("settings.issuer.name")}
              <input
                maxLength={SETTINGS_LIMITS.issuerName}
                value={form.issuerName}
                onChange={(event) => updateField("issuerName", event.target.value)}
                aria-invalid={Boolean(fieldErrors.issuerName)}
                className={`${fieldClassName} ${fieldErrors.issuerName ? "border-overdue" : ""}`}
              />
              {fieldErrors.issuerName ? (
                <span role="alert" className="text-[12px] font-normal text-overdue">
                  {fieldErrors.issuerName}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              {t("settings.issuer.address")}
              <textarea
                maxLength={SETTINGS_LIMITS.issuerAddress}
                value={form.issuerAddress}
                onChange={(event) => updateField("issuerAddress", event.target.value)}
                className="min-h-20 rounded-sm border border-line bg-surface px-3 py-2 text-[15px] font-normal text-ink outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              {t("settings.issuer.whatsapp")}
              <input
                maxLength={SETTINGS_LIMITS.issuerWhatsapp}
                value={form.issuerWhatsapp}
                onChange={(event) => updateField("issuerWhatsapp", event.target.value)}
                inputMode="tel"
                className={fieldClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              {t("settings.issuer.email")}
              <input
                maxLength={SETTINGS_LIMITS.issuerEmail}
                value={form.issuerEmail}
                onChange={(event) => updateField("issuerEmail", event.target.value)}
                type="email"
                aria-invalid={Boolean(fieldErrors.issuerEmail)}
                className={`${fieldClassName} ${fieldErrors.issuerEmail ? "border-overdue" : ""}`}
              />
              {fieldErrors.issuerEmail ? (
                <span role="alert" className="text-[12px] font-normal text-overdue">
                  {fieldErrors.issuerEmail}
                </span>
              ) : null}
            </label>
          </div>
        </section>

        <section aria-labelledby="settings-bank-heading" className="border-b border-line pb-8">
          <h2 id="settings-bank-heading" className="text-[16px] font-bold text-ink">
            {t("settings.bank.heading")}
          </h2>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              {t("settings.bank.name")}
              <input
                maxLength={SETTINGS_LIMITS.bankName}
                value={form.bankName}
                onChange={(event) => updateField("bankName", event.target.value)}
                aria-invalid={Boolean(fieldErrors.bankName)}
                className={`${fieldClassName} ${fieldErrors.bankName ? "border-overdue" : ""}`}
              />
              {fieldErrors.bankName ? (
                <span role="alert" className="text-[12px] font-normal text-overdue">
                  {fieldErrors.bankName}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              {t("settings.bank.accountNumber")}
              <input
                maxLength={SETTINGS_LIMITS.bankAccountNumber}
                value={form.bankAccountNumber}
                onChange={(event) => updateField("bankAccountNumber", event.target.value)}
                inputMode="numeric"
                aria-invalid={Boolean(fieldErrors.bankAccountNumber)}
                className={`${fieldClassName} ${fieldErrors.bankAccountNumber ? "border-overdue" : ""}`}
              />
              {fieldErrors.bankAccountNumber ? (
                <span role="alert" className="text-[12px] font-normal text-overdue">
                  {fieldErrors.bankAccountNumber}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              {t("settings.bank.accountHolder")}
              <input
                maxLength={SETTINGS_LIMITS.bankAccountHolder}
                value={form.bankAccountHolder}
                onChange={(event) => updateField("bankAccountHolder", event.target.value)}
                aria-invalid={Boolean(fieldErrors.bankAccountHolder)}
                className={`${fieldClassName} ${fieldErrors.bankAccountHolder ? "border-overdue" : ""}`}
              />
              {fieldErrors.bankAccountHolder ? (
                <span role="alert" className="text-[12px] font-normal text-overdue">
                  {fieldErrors.bankAccountHolder}
                </span>
              ) : null}
            </label>
          </div>
        </section>

        <section aria-labelledby="settings-templates-heading" className="border-b border-line pb-8">
          <h2 id="settings-templates-heading" className="text-[16px] font-bold text-ink">
            {t("settings.templates.heading")}
            <span className="ml-2 inline-flex items-center rounded-full border border-line px-2 py-0.5 align-middle text-[11px] font-bold text-muted">
              {t("settings.templates.idOnlyBadge")}
            </span>
          </h2>
          <p className="mt-1 text-[13px] text-muted">{t("settings.templates.idOnlyHelper")}</p>

          <div className="mt-4 flex flex-col gap-6">
            <div>
              <label htmlFor="settings-template-send" className="text-[13px] font-semibold text-ink">
                {t("settings.templates.send")}
              </label>
              <textarea
                id="settings-template-send"
                maxLength={SETTINGS_LIMITS.templateSend}
                value={form.templateSend}
                onChange={(event) => updateField("templateSend", event.target.value)}
                className="mt-1.5 min-h-28 w-full rounded-sm border border-line bg-surface px-3 py-2 text-[15px] font-normal text-ink outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t("settings.templates.tokensLabel")}>
                {TEMPLATE_TOKENS.map((token) => (
                  <span key={token} className="rounded-full bg-bg px-2.5 py-1 text-[12px] font-semibold text-muted">
                    {token}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => resetTemplate("templateSend")}
                className="mt-2 h-11 text-[13px] font-semibold text-primary"
              >
                {t("settings.templates.reset")}
              </button>
            </div>

            <div>
              <label htmlFor="settings-template-chase" className="text-[13px] font-semibold text-ink">
                {t("settings.templates.chase")}
              </label>
              <textarea
                id="settings-template-chase"
                maxLength={SETTINGS_LIMITS.templateChase}
                value={form.templateChase}
                onChange={(event) => updateField("templateChase", event.target.value)}
                className="mt-1.5 min-h-28 w-full rounded-sm border border-line bg-surface px-3 py-2 text-[15px] font-normal text-ink outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t("settings.templates.tokensLabel")}>
                {TEMPLATE_TOKENS.map((token) => (
                  <span key={token} className="rounded-full bg-bg px-2.5 py-1 text-[12px] font-semibold text-muted">
                    {token}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => resetTemplate("templateChase")}
                className="mt-2 h-11 text-[13px] font-semibold text-primary"
              >
                {t("settings.templates.reset")}
              </button>
            </div>
          </div>
        </section>

        {formError ? (
          <p role="alert" className="text-[13px] text-overdue">
            {formError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSaving} loading={isSaving} loadingLabel={t("dashboard.saving")}>
            {t("settings.save")}
          </Button>
          {status === "saved" ? (
            <span role="status" className="text-[13px] font-semibold text-paid">
              {t("settings.saved")}
            </span>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="settings-signout-heading" className="pb-4">
        <h2 id="settings-signout-heading" className="sr-only">
          {t("dashboard.signOut")}
        </h2>
        {email ? <p className="text-[13px] text-muted">{email}</p> : null}
        {!signOutConfirming ? (
          <button
            type="button"
            onClick={() => setSignOutConfirming(true)}
            className="mt-3 inline-flex h-11 min-w-11 items-center justify-center text-[14px] font-semibold text-overdue outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("dashboard.signOut")}
          </button>
        ) : (
          <div className="mt-3 rounded-xl bg-bg p-3">
            <p className="text-[13px] font-semibold text-ink">{t("settings.signOut.confirmTitle")}</p>
            <div className="mt-3 flex flex-col gap-2 min-[360px]:flex-row">
              <button
                type="button"
                onClick={() => setSignOutConfirming(false)}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink min-[360px]:w-auto"
              >
                {t("invoice.cancel")}
              </button>
              <Link
                href="/api/auth/signout?callbackUrl=/"
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-overdue px-4 text-[14px] font-semibold text-surface min-[360px]:w-auto"
              >
                {t("settings.signOut.confirmAction")}
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
