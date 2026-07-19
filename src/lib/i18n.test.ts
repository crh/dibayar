import { describe, expect, it } from "vitest";
import { getLanguage, translate, type Language } from "./i18n";

describe("i18n", () => {
  it("defaults unknown values to Indonesian", () => {
    expect(getLanguage("fr")).toBe("id");
    expect(getLanguage(null)).toBe("id");
  });

  it("returns English translations when selected", () => {
    expect(translate("en", "dashboard.greeting", { name: "Chris" })).toBe("Hello, Chris");
    expect(translate("en", "dashboard.signOut")).toBe("Sign out");
  });

  it("falls back to the key for missing translations", () => {
    expect(translate("id" as Language, "missing.key")).toBe("missing.key");
  });
});
