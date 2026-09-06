import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getLanguage, type Language } from "@/lib/i18n";
import { LanguageProvider } from "@/components/language-switcher";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
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
