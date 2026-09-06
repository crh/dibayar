import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserSettings, type UserSettingsDb } from "@/lib/user-settings";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

const db = prisma as unknown as UserSettingsDb;

export default async function PengaturanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fpengaturan");
  }

  const settings = await getUserSettings(db, session.user.id);

  return (
    <main className="mx-auto w-full max-w-[640px] px-5 py-8 sm:px-8">
      <SettingsForm initialSettings={settings} email={session.user.email} />
    </main>
  );
}
