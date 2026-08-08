import { translate, type Language } from "@/lib/i18n";

export function getRouteTitle(pathname: string, language: Language): string {
  if (pathname === "/deal" || pathname.startsWith("/deal/")) {
    return translate(language, "nav.deals");
  }
  if (pathname === "/invoice" || pathname.startsWith("/invoice/")) {
    return translate(language, "nav.invoices");
  }
  if (pathname === "/pengaturan") {
    return translate(language, "nav.settings");
  }
  return translate(language, "nav.home");
}
