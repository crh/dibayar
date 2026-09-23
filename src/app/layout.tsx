import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { getLanguage, type Language } from "@/lib/i18n";
import { LanguageProvider } from "@/components/language-switcher";
import "./globals.css";

// Self-hosted (not next/font/google) so `next build` never depends on
// reaching Google's font CDN -- see src/app/fonts/NOTICE.md.
const plusJakartaSans = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/plus-jakarta-sans/plus-jakarta-sans-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  variable: "--font-plus-jakarta",
});

const LANGUAGE_COOKIE = "dibayar-language";

const METADATA_BY_LANGUAGE: Record<Language, { title: string; description: string }> = {
  en: {
    title: "Dibayar — Manage deals until you get paid",
    description:
      "Dibayar helps Indonesian creators manage brand deals, invoices, and payment reminders in one place.",
  },
  id: {
    title: "Dibayar — Kelola deal sampai dibayar",
    description:
      "Dibayar membantu kreator Indonesia mengelola deal brand, invoice, dan pengingat pembayaran di satu tempat.",
  },
};

async function readLanguageCookie(): Promise<Language> {
  const cookieStore = await cookies();
  return getLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const language = await readLanguageCookie();
  const copy = METADATA_BY_LANGUAGE[language];

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      languages: { en: "/", id: "/" },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await readLanguageCookie();

  return (
    <html lang={language} className="h-full antialiased">
      <body className={`${plusJakartaSans.variable} flex min-h-full flex-col font-sans`}>
        <LanguageProvider initialLanguage={language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
