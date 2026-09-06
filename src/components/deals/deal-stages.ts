import type { DealRecord } from "@/lib/deals";

export type StageValue = DealRecord["status"];

export const PIPELINE_STAGES = [
  { value: "MASUK", label: "Masuk" },
  { value: "NEGO", label: "Nego" },
  { value: "DEAL", label: "Deal" },
  { value: "KONTEN", label: "Konten" },
  { value: "INVOICE", label: "Invoice" },
  { value: "DIBAYAR", label: "Dibayar" },
] as const satisfies ReadonlyArray<{ value: StageValue; label: string }>;

export const PIPELINE_STAGE_KEYS: Record<StageValue, string> = {
  MASUK: "stage.inbox",
  NEGO: "stage.negotiation",
  DEAL: "stage.deal",
  KONTEN: "stage.content",
  INVOICE: "stage.invoice",
  DIBAYAR: "stage.paid",
};

const STAGE_VALUES = new Set<string>(PIPELINE_STAGES.map((stage) => stage.value));

export function isStageValue(value: string | null | undefined): value is StageValue {
  return value != null && STAGE_VALUES.has(value);
}
