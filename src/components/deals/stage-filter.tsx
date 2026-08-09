import { PIPELINE_STAGES, PIPELINE_STAGE_KEYS, type StageValue } from "./deal-stages";

const CHIP_BASE =
  "inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary";
const CHIP_ACTIVE = "border-primary bg-primary text-surface";
const CHIP_INACTIVE = "border-line bg-surface text-ink";

export function StageFilter({
  stageFilter,
  t,
  onChange,
}: {
  stageFilter: StageValue | null;
  t: (key: string, values?: Record<string, string>) => string;
  onChange: (stage: StageValue | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label={t("board.filterLabel")}
      className="flex gap-2 overflow-x-auto pb-1"
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
  );
}
