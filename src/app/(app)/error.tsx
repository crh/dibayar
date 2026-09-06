"use client";

import { useLanguage } from "@/components/language-switcher";

export default function BerandaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center min-[640px]:px-6">
      <p role="alert" className="text-[15px] font-semibold text-overdue">{t("home.loadError")}</p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t("action.retry")}
      </button>
    </main>
  );
}
