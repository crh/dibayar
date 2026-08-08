"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";

export function SideNav({ pathname }: { pathname: string }) {
  const { t } = useLanguage();

  return (
    <nav
      data-testid="side-nav"
      aria-label={t("nav.label")}
      className="hidden min-[1024px]:flex min-[1024px]:sticky min-[1024px]:top-16 min-[1024px]:h-[calc(100vh-4rem)] min-[1024px]:overflow-y-auto min-[1024px]:w-[240px] min-[1440px]:w-[264px] flex-shrink-0 flex-col gap-1 border-r border-line bg-surface p-3"
    >
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 items-center rounded-[12px] border-l-4 px-3 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active ? "border-l-primary bg-primary-tint text-primary-d" : "border-l-transparent text-ink hover:bg-bg"
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
