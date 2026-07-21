export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Web fallback for the native haptic spec: one short pulse on paid only. */
export function triggerPaidHaptic(): void {
  if (typeof navigator === "undefined" || prefersReducedMotion()) return;
  if ("vibrate" in navigator) navigator.vibrate(10);
}
