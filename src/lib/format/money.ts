import { NUMBER_DATE_LOCALE } from "@/lib/locale";

const GROUPING = new Intl.NumberFormat(NUMBER_DATE_LOCALE, { maximumFractionDigits: 0 });

// Always id-ID grouping regardless of uiLanguage: no signature accepts a
// language, so a call site cannot accidentally couple this to the UI locale.
export function formatMoney(amountIdr: number): string {
  const rounded = Math.round(amountIdr);
  const grouped = GROUPING.format(Math.abs(rounded));
  const sign = rounded < 0 ? "−" : "";
  return `${sign}Rp ${grouped}`;
}
