export const UX_VIEWPORTS = {
  xs320: { width: 320, height: 800 },
  sm390: { width: 390, height: 844 },
  md768: { width: 768, height: 1024 },
  lg1024: { width: 1024, height: 900 },
  xl1440: { width: 1440, height: 900 },
} as const;

export type UxViewportKey = keyof typeof UX_VIEWPORTS;
export const UX_LANGUAGES = ["id", "en"] as const;
export type UxLanguage = (typeof UX_LANGUAGES)[number];
