import type { ReactNode } from "react";

// Shared branded shell for this route's non-happy-path states (expired
// share link in page.tsx, and this segment's not-found.tsx for an
// invalid/unknown token). Every other screen in the app -- including the
// active public invoice itself -- renders inside a card with the "Dibayar"
// wordmark visible; these states used to be bare centered text on a blank
// page (OBSERVATIONS.md). Deliberately dumb/static: it renders identically
// regardless of *why* the caller reached it, so it can't leak which of
// "expired", "invalid token", "malformed token", or "rate-limited" a
// visitor actually hit -- see page.tsx's comment on why those are kept
// indistinguishable.
export function PublicErrorCard({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-5 py-8 text-center">
      <span className="text-[15px] font-bold text-ink">Dibayar</span>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
