import type { ReactElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));

import RootLayout, { generateMetadata } from "./layout";

function cookieJar(value?: string) {
  return {
    get: (name: string) => (name === "dibayar-language" && value !== undefined ? { name, value } : undefined),
  };
}

beforeEach(() => {
  cookies.mockReset();
  cookies.mockResolvedValue(cookieJar());
});

describe("RootLayout metadata", () => {
  it("defaults to English metadata with no language cookie", async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toContain("Dibayar");
    expect(metadata.description).toMatch(/creators/i);
  });

  it("returns Indonesian metadata when the language cookie is id", async () => {
    cookies.mockResolvedValue(cookieJar("id"));

    const metadata = await generateMetadata();

    expect(metadata.description).toMatch(/kreator/i);
  });

  it("exposes bilingual alternate language links", async () => {
    const metadata = await generateMetadata();

    expect(metadata.alternates?.languages).toEqual({ en: "/", id: "/" });
  });
});

describe("RootLayout", () => {
  it("renders the document in English by default with no language cookie", async () => {
    const element = (await RootLayout({ children: null })) as ReactElement<{
      lang?: string;
      className?: string;
    }>;

    expect(element.props.lang).toBe("en");
    expect(element.props.className).not.toMatch(/font-geist/i);
  });

  it("renders the document in Indonesian when the language cookie is id", async () => {
    cookies.mockResolvedValue(cookieJar("id"));

    const element = (await RootLayout({ children: null })) as ReactElement<{ lang?: string }>;

    expect(element.props.lang).toBe("id");
  });
});
