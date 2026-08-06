// Single-source responsive breakpoint tokens. See DESIGN.md / dibayar-implementation-spec.md
// §4.0 responsive bands. Values are pixel widths and must not be duplicated elsewhere.
export const BREAKPOINTS = Object.freeze({
  XS: 320,
  SM: 360,
  MD: 640,
  LG: 1024,
  XL: 1440,
} as const);

export type BreakpointName = keyof typeof BREAKPOINTS;
export type BreakpointValue = (typeof BREAKPOINTS)[BreakpointName];
