import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LanguageProvider } from "@/components/language-switcher";
import { AppShell } from "@/components/layout/app-shell";
import { getUserLanguage, type UserLanguageDb } from "@/lib/user-language";
import { prisma } from "@/lib/prisma";

const languageDb = prisma as unknown as UserLanguageDb;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2F");
  }

  const language = await getUserLanguage(languageDb, session.user.id);

  return (
    <LanguageProvider initialLanguage={language} authenticated>
      <AppShell email={session.user.email}>{children}</AppShell>
    </LanguageProvider>
  );
}
