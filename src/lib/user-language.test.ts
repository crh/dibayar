import { describe, expect, it, vi } from "vitest";
import { getUserLanguage, updateUserLanguage, type UserLanguageDb } from "./user-language";

function makeDb(overrides: Partial<UserLanguageDb["user"]> = {}): UserLanguageDb {
  return {
    user: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data }) => ({ language: data.language })),
      ...overrides,
    },
  };
}

describe("getUserLanguage", () => {
  it("returns the stored language for the user", async () => {
    const db = makeDb({ findUnique: vi.fn(async () => ({ language: "id" })) });

    expect(await getUserLanguage(db, "user-1")).toBe("id");
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" }, select: { language: true } });
  });

  it("defaults to Indonesian for an unrecognized stored value", async () => {
    const db = makeDb({ findUnique: vi.fn(async () => ({ language: "fr" })) });

    expect(await getUserLanguage(db, "user-1")).toBe("id");
  });

  it("defaults to Indonesian when the user row is missing", async () => {
    const db = makeDb({ findUnique: vi.fn(async () => null) });

    expect(await getUserLanguage(db, "user-x")).toBe("id");
  });
});

describe("updateUserLanguage", () => {
  it("updates only the given user's language", async () => {
    const db = makeDb();

    await updateUserLanguage(db, "user-1", "id");

    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { language: "id" } });
  });
});
