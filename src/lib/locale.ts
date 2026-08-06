// uiLanguage is the only locale value stored on the User record (as
// `language`); numberDateLocale and documentLanguage are fixed and must
// never be persisted or vary per user. See SPEC_RECONCILIATION.md T-01.
// This is the dependency-free source of truth for the UI language: i18n.ts
// re-exports these names for backward compatibility, but never the reverse,
// so there is exactly one place a locale/language cycle could start from.
export const UI_LANGUAGES = ["id", "en"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];
export const DEFAULT_UI_LANGUAGE: UiLanguage = "id";

export const NUMBER_DATE_LOCALE = "id-ID" as const;
export const DOCUMENT_LANGUAGE = "id" as const;
