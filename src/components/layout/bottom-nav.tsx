"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";

export function BottomNav({ pathname }: { pathname: string }) {
  const { t } = useLanguage();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-30 box-content flex h-14 items-stretch justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] min-[640px]:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
