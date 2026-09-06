import { describe, expect, it } from "vitest";
import { DEFAULT_UI_LANGUAGE, DOCUMENT_LANGUAGE, NUMBER_DATE_LOCALE, UI_LANGUAGES } from "./locale";

describe("locale", () => {
  it("defaults the UI language to Indonesian", () => {
    expect(DEFAULT_UI_LANGUAGE).toBe("id");
  });

  it("lists id and en as the only selectable UI languages", () => {
    expect(UI_LANGUAGES).toEqual(["id", "en"]);
  });

  it("fixes numberDateLocale as a non-selectable id-ID constant", () => {
    expect(NUMBER_DATE_LOCALE).toBe("id-ID");
  });

  it("fixes documentLanguage as a non-selectable id constant", () => {
    expect(DOCUMENT_LANGUAGE).toBe("id");
  });
});
