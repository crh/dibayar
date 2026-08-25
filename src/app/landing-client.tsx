"use client";

import Link from "next/link";
import { LanguageProvider, useLanguage } from "@/components/language-switcher";
import type { Language } from "@/lib/i18n";

const PIPELINE_STAGE_KEYS = [
  "stage.inbox",
  "stage.negotiation",
  "stage.deal",
  "stage.content",
  "stage.invoice",
  "stage.paid",
];

const HOW_IT_WORKS = [
  { titleKey: "landing.step1Title", detailKey: "landing.step1Detail" },
  { titleKey: "landing.step2Title", detailKey: "landing.step2Detail" },
  { titleKey: "landing.step3Title", detailKey: "landing.step3Detail" },
];

// T-25: one centred column, max-width 620px, no second column at any width
// (dibayar-implementation-spec.md §4.9). Exactly the five prescribed blocks
// in order -- headline, subhead, workflow chips, sign-in, three steps -- with
// 24px between blocks and 40px above the three-steps block. The language
// switcher and the old jump-to-section link are gone: language switching
// already lives in Settings post-sign-in, and a single-page layout has
// nowhere else to jump to.
function LandingContent() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-[620px] flex-col px-5 pb-8 pt-8 sm:px-8 sm:pt-12 lg:pt-20">
        <div>
          <p className="text-[13px] font-bold tracking-tight text-ink">Dibayar</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight text-ink">{t("landing.heroHeading")}</h1>
        </div>

        <p className="mt-6 text-[15px] leading-6 text-muted">{t("landing.heroSubtitle")}</p>

        <div className="mt-6">
          <h2 id="alur-kerja" className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            {t("landing.workflowHeading")}
          </h2>
          <ol aria-labelledby="alur-kerja" className="mt-3 flex flex-wrap gap-2">
            {PIPELINE_STAGE_KEYS.map((key) => (
              <li
                key={key}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink"
              >
                {t(key)}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <p className="text-[14px] text-muted">{t("landing.accessNotice")}</p>
          <Link
            href="/api/auth/signin?callbackUrl=%2Fdashboard"
            className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-d"
          >
            {t("landing.signInGoogle")}
          </Link>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-8">
          <h2 className="text-[20px] font-bold text-ink">{t("landing.howItWorksHeading")}</h2>
          <ol className="flex flex-col gap-4">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.titleKey} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paid text-[13px] font-semibold text-surface">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold text-ink">{t(step.titleKey)}</p>
                  <p className="text-[13px] leading-5 text-muted">{t(step.detailKey)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </div>
  );
}

export default function LandingClient({ initialLanguage }: { initialLanguage: Language }) {
  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      <LandingContent />
    </LanguageProvider>
  );
}
