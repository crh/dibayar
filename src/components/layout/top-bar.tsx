"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";
import { getRouteTitle } from "./route-title";
import { AccountMenu } from "../account-menu";

export function TopBar({ pathname, email }: { pathname: string; email?: string | null }) {
  const { language, t } = useLanguage();
  const routeTitle = getRouteTitle(pathname, language);

  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-30 flex h-14 min-[640px]:h-16 items-center justify-between gap-4 border-b border-line bg-bg px-4 min-[640px]:px-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-6">
        <span className="min-[1024px]:hidden text-[15px] font-bold text-ink">Dibayar</span>
        <span data-testid="route-title" className="hidden min-[1024px]:inline text-[17px] font-bold text-ink">
          {routeTitle}
        </span>
        <nav
          data-testid="top-bar-nav"
          aria-label={t("nav.label")}
          className="hidden min-[640px]:flex min-[1024px]:hidden items-center gap-4"
        >
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`ds-tap-target flex h-11 items-center text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active ? "text-primary" : "text-ink"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden min-[640px]:flex items-center gap-2">
          <Link
            href="/deal"
            className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("action.newDeal")}
          </Link>
          <Link
            href="/deal?tahap=INVOICE"
            className="hidden min-[1024px]:inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("action.newInvoice")}
          </Link>
        </div>
        <AccountMenu language={language} email={email} />
      </div>
    </header>
  );
}
