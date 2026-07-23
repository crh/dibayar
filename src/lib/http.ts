export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

// Races fetch against our own abort timer instead of relying solely on the
// underlying fetch to honor AbortSignal, so a hung request (or a test double
// that ignores the signal) still surfaces as a rejection within timeoutMs.
export function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return Promise.race([
    fetch(input, { ...init, signal: controller.signal }),
    new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new Error("Permintaan melebihi batas waktu.")));
    }),
  ]).finally(() => clearTimeout(timeout));
}
