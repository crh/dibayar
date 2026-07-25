import { describe, expect, it } from "vitest";
import { getLanguage, translate, type Language } from "./i18n";

describe("i18n", () => {
  it("defaults unknown values to English", () => {
    expect(getLanguage("fr")).toBe("en");
    expect(getLanguage(null)).toBe("en");
  });

  it("selects Indonesian only for the explicit id value", () => {
    expect(getLanguage("id")).toBe("id");
  });

  it("returns English translations by default", () => {
    expect(translate("en", "dashboard.greeting", { name: "Chris" })).toBe("Hello, Chris");
    expect(translate("en", "dashboard.signOut")).toBe("Sign out");
  });

  it("returns Indonesian translations when selected", () => {
    expect(translate("id", "dashboard.greeting", { name: "Chris" })).toBe("Halo, Chris");
    expect(translate("id", "dashboard.signOut")).toBe("Keluar");
  });

  it("falls back to the key for a translation missing from both dictionaries", () => {
    expect(translate("id" as Language, "missing.key")).toBe("missing.key");
    expect(translate("en", "missing.key")).toBe("missing.key");
  });
});
