import type { ReactNode } from "react";

// Single column below the LG breakpoint (1024px); 12 equal minmax columns with
// 24px gutters at LG and above. Rules live in globals.css under `.ds-grid`.
export function Grid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={["ds-grid", className].filter(Boolean).join(" ")}>{children}</div>;
}
