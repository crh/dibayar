"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";

// Phone-only global "+ Deal" action. Mirrors the top bar's "+ Deal" link
// (same destination) so a deal can always be started from any screen below
// the MD band, where the top bar's inline action is hidden.
export function FloatingActionButton() {
  const { t } = useLanguage();
  const label = t("action.newDeal");

  return (
    <Link
      href="/deal"
      className="fixed z-40 right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-surface shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-[640px]:hidden"
    >
      <span aria-hidden="true" className="text-[28px] font-bold leading-none">+</span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
