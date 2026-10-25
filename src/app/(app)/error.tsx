"use client";

import { useLanguage } from "@/components/language-switcher";

// `retry`, not `reset`: this boundary mostly catches a server component that
// threw (a failed query). reset() only re-renders what the browser already
// has, which is that same failure, so "Coba lagi" stayed on the error card
// even after the cause was gone (FIND-12). retry() asks the server for the
// segment again and replaces the card when that succeeds.
export default function BerandaError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center min-[640px]:px-6">
      <p role="alert" className="text-[15px] font-semibold text-overdue">{t("home.loadError")}</p>
      <button
        type="button"
        onClick={retry}
        className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t("action.retry")}
      </button>
    </main>
  );
}
