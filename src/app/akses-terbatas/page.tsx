import Link from "next/link";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getLanguage, translate } from "@/lib/i18n";

const LANGUAGE_COOKIE = "dibayar-language";

export const dynamic = "force-dynamic";

type AccessPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Auth.js error page (pages.error in src/auth.ts) and the redirect target
// for a session whose account is not on the pilot allowlist. The copy is
// the same for every denied account and never echoes the email.
export default async function AccessRestrictedPage({ searchParams }: AccessPageProps) {
  const [cookieStore, params, session] = await Promise.all([cookies(), searchParams, auth()]);
  const language = getLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = (key: string) => translate(language, key);
  const error = typeof params.error === "string" ? params.error : undefined;
  // A denied existing session, or Auth.js's AccessDenied from the sign-in gate.
  const denied = session?.pilotAccessDenied === true || error === "AccessDenied" || error === undefined;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-5 pb-8 pt-8 sm:px-8 sm:pt-12 lg:pt-20">
        <p className="text-[13px] font-bold tracking-tight text-ink">Dibayar</p>
        <h1 className="text-[22px] font-bold leading-tight text-ink">{t("access.title")}</h1>
        <p className="text-[15px] leading-6 text-muted">{t(denied ? "access.deniedBody" : "access.errorBody")}</p>
        <div className="mt-2 flex flex-col gap-3">
          {session?.pilotAccessDenied ? (
            <Link
              href="/api/auth/signout?callbackUrl=%2Fmasuk"
              className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-d"
            >
              {t("access.signOut")}
            </Link>
          ) : (
            <Link
              href="/api/auth/signin?callbackUrl=%2Fdashboard"
              className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-d"
            >
              {t("access.signInOther")}
            </Link>
          )}
          <Link href="/masuk" className="inline-flex min-h-11 w-fit items-center text-[15px] font-semibold text-primary underline">
            {t("access.backHome")}
          </Link>
        </div>
      </main>
    </div>
  );
}
