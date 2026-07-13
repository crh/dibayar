import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "./layout";

describe("RootLayout", () => {
  it("exposes Bahasa Indonesia metadata", () => {
    expect(metadata.title).toContain("Dibayar");
    expect(metadata.description).toMatch(/kreator/i);
  });

  it("renders the document in Bahasa Indonesia without Google font loading", () => {
    const element = RootLayout({ children: null }) as ReactElement<{
      lang?: string;
      className?: string;
    }>;

    expect(element.props.lang).toBe("id");
    expect(element.props.className).not.toMatch(/font-geist/i);
  });
});
