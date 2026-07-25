"use client";

import Link from "next/link";
import { LanguageProvider, LanguageSwitcher, useLanguage } from "@/components/language-switcher";
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

function LandingContent() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-5 py-12 sm:px-8 lg:grid lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-20">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[17px] font-bold tracking-tight text-ink">Dibayar</p>
            <LanguageSwitcher language={language} onChange={setLanguage} compact />
          </div>
          <span className="inline-flex h-7 w-fit items-center rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-primary">
            {t("landing.comingSoon")}
          </span>
          <Link
            href="/api/auth/signin?callbackUrl=%2Fdashboard"
            className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-d"
          >
            {t("landing.signInGoogle")}
          </Link>
        </header>

        <section className="flex flex-col gap-3">
          <h1 className="text-[26px] font-bold leading-tight text-ink">{t("landing.heroHeading")}</h1>
          <p className="text-[15px] leading-6 text-muted">{t("landing.heroSubtitle")}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2
            id="alur-kerja"
            className="text-[13px] font-semibold uppercase tracking-wide text-muted"
          >
            {t("landing.workflowHeading")}
          </h2>
          <ol aria-labelledby="alur-kerja" className="flex flex-wrap gap-2">
            {PIPELINE_STAGE_KEYS.map((key) => (
              <li
                key={key}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink"
              >
                {t(key)}
              </li>
            ))}
          </ol>
          <a
            href="#cara-kerja"
            className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface transition-colors hover:bg-primary-d"
          >
            {t("landing.seeHowItWorks")}
          </a>
        </section>

        <section id="cara-kerja" className="flex flex-col gap-4 border-t border-line pt-8">
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
        </section>
      </main>

      <footer className="mx-auto w-full max-w-md px-5 pb-8">
        <p className="text-[13px] text-muted">{t("landing.footer")}</p>
      </footer>
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
