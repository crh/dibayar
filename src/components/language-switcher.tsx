"use client";

import { useSyncExternalStore } from "react";
import { getLanguage, translate, type Language } from "@/lib/i18n";

const STORAGE_KEY = "dibayar-language";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getClientLanguage() {
  return getLanguage(window.localStorage.getItem(STORAGE_KEY));
}

function getServerLanguage(): Language {
  return "id";
}

export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getClientLanguage, getServerLanguage);

  const setLanguage = (next: Language) => {
    const languageValue = getLanguage(next);
    window.localStorage.setItem(STORAGE_KEY, languageValue);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: languageValue }));
    document.documentElement.lang = languageValue;
  };

  const t = (key: string, values?: Record<string, string>) => translate(language, key, values);
  return { language, setLanguage, t };
}

export function LanguageSwitcher({ language, onChange, compact = false }: {
  language: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
}) {
  return (
    <label className={`inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 ${compact ? "h-9 text-[12px]" : "h-11 text-[13px]"}`}>
      <span className="font-semibold text-muted">{translate(language, "language.label")}</span>
      <select
        aria-label={translate(language, "language.label")}
        value={language}
        onChange={(event) => onChange(getLanguage(event.target.value))}
        className="bg-transparent font-semibold text-ink outline-none"
      >
        <option value="id">{translate(language, "language.indonesian")}</option>
        <option value="en">{translate(language, "language.english")}</option>
      </select>
    </label>
  );
}
