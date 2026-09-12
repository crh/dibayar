"use client";

import { useEffect, useRef, useState } from "react";
import { PIPELINE_STAGES, PIPELINE_STAGE_KEYS, type StageValue } from "./deal-stages";

const CHIP_BASE =
  "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary";
const CHIP_ACTIVE = "border-primary bg-primary text-surface";
const CHIP_INACTIVE = "border-line bg-surface text-ink";

// A row this narrow at 390px always has more stages than fit on screen, so
// the initial view legitimately shows a partially-cut last chip -- that's
// supposed to *be* the "scroll for more" affordance, but with no visual
// treatment it reads as a rendering glitch instead (see OBSERVATIONS.md).
// The edge fades make the cut-off intentional-looking; they track real
// scroll position so a fade never claims there's more content when the row
// is already scrolled all the way to that edge.
export function StageFilter({
  stageFilter,
  t,
  onChange,
}: {
  stageFilter: StageValue | null;
  t: (key: string, values?: Record<string, string>) => string;
  onChange: (stage: StageValue | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    // jsdom (component tests) has no ResizeObserver; the scroll listener
    // above already covers real usage, so treat this as progressive
    // enhancement rather than a hard dependency.
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    resizeObserver?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        role="group"
        aria-label={t("board.filterLabel")}
        data-ux-scroll="stage-filter"
        className="flex gap-2 overflow-x-auto pb-1 pr-6"
      >
        <button
          type="button"
          aria-pressed={stageFilter === null}
          onClick={() => onChange(null)}
          className={`${CHIP_BASE} ${stageFilter === null ? CHIP_ACTIVE : CHIP_INACTIVE}`}
        >
          {t("board.all")}
        </button>
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage.value}
            type="button"
            aria-pressed={stageFilter === stage.value}
            onClick={() => onChange(stage.value)}
            className={`${CHIP_BASE} ${stageFilter === stage.value ? CHIP_ACTIVE : CHIP_INACTIVE}`}
          >
            {t(PIPELINE_STAGE_KEYS[stage.value])}
          </button>
        ))}
      </div>
      <div
        aria-hidden="true"
        data-testid="stage-filter-scroll-hint-left"
        data-visible={canScrollLeft}
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent transition-opacity ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden="true"
        data-testid="stage-filter-scroll-hint-right"
        data-visible={canScrollRight}
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent transition-opacity ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
