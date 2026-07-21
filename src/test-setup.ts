import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Plus_Jakarta_Sans: () => ({ variable: "font-plus-jakarta", className: "font-plus-jakarta" }),
  Source_Serif_4: () => ({ variable: "font-source-serif", className: "font-source-serif" }),
}));
