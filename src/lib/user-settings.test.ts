import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPLATE_CHASE, DEFAULT_TEMPLATE_SEND } from "./user-settings-validation";
import { getUserSettings, saveUserSettings, type UserSettingsDb, type UserSettingsRecord } from "./user-settings";

const minimalInput = {
  issuerName: "Kenji Creator",
  bankName: "Bank Central",
  bankAccountNumber: "1234567890",
  bankAccountHolder: "Kenji Creator",
};

function makeDb(records: Map<string, UserSettingsRecord> = new Map()): UserSettingsDb {
  return {
    userSettings: {
      findUnique: vi.fn(async ({ where }) => records.get(where.userId) ?? null),
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = records.get(where.userId);
        const record: UserSettingsRecord = {
          ...(existing ?? create),
          ...(existing ? update : create),
          updatedAt: new Date("2026-08-09T00:00:00.000Z"),
        };
        records.set(where.userId, record);
        return record;
      }),
    },
  };
}

describe("getUserSettings", () => {
  it("returns an all-defaults view when the user has no saved row", async () => {
    const db = makeDb();

    const result = await getUserSettings(db, "user-1");

    expect(result).toEqual({
      issuerName: "",
      issuerAddress: "",
      issuerWhatsapp: "",
      issuerEmail: "",
      bankName: "",
      bankAccountNumber: "",
      bankAccountHolder: "",
      templateSend: DEFAULT_TEMPLATE_SEND,
      templateChase: DEFAULT_TEMPLATE_CHASE,
      updatedAt: null,
    });
    expect(db.userSettings.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("only ever reads the caller's own row", async () => {
    const db = makeDb();
    await getUserSettings(db, "user-2");
    expect(db.userSettings.findUnique).toHaveBeenCalledWith({ where: { userId: "user-2" } });
  });

  it("fills in the default template only for fields never customized", async () => {
    const records = new Map<string, UserSettingsRecord>([
      [
        "user-1",
        {
          issuerName: "Kenji",
          issuerAddress: null,
          issuerWhatsapp: null,
          issuerEmail: null,
          bankName: "Bank",
          bankAccountNumber: "123",
          bankAccountHolder: "Kenji",
          templateSend: "Custom send",
          templateChase: null,
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    ]);
    const db = makeDb(records);

    const result = await getUserSettings(db, "user-1");

    expect(result.templateSend).toBe("Custom send");
    expect(result.templateChase).toBe(DEFAULT_TEMPLATE_CHASE);
    expect(result.updatedAt).toEqual(new Date("2026-08-01T00:00:00.000Z"));
  });
});

describe("saveUserSettings", () => {
  it("creates a row on first save, scoped to the given user id", async () => {
    const db = makeDb();

    const result = await saveUserSettings(db, "user-1", minimalInput);

    expect(result.issuerName).toBe("Kenji Creator");
    expect(db.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({ userId: "user-1", issuerName: "Kenji Creator" }),
      }),
    );
  });

  it("normalizes unset optional fields and templates to null on write", async () => {
    const db = makeDb();

    await saveUserSettings(db, "user-1", minimalInput);

    expect(db.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          issuerAddress: null,
          issuerWhatsapp: null,
          issuerEmail: null,
          templateSend: null,
          templateChase: null,
        }),
      }),
    );
  });

  it("reloads via upsert on a second save (update path), not a duplicate create", async () => {
    const db = makeDb();
    await saveUserSettings(db, "user-1", minimalInput);

    const result = await saveUserSettings(db, "user-1", { ...minimalInput, issuerName: "Renamed" });

    expect(result.issuerName).toBe("Renamed");
    expect(db.userSettings.upsert).toHaveBeenCalledTimes(2);
  });

  it("never lets a client-supplied userId in the payload override the authenticated id", async () => {
    const db = makeDb();

    await saveUserSettings(db, "user-1", { ...minimalInput, userId: "someone-else" });

    expect(db.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("rejects invalid input before touching the database", async () => {
    const db = makeDb();

    await expect(saveUserSettings(db, "user-1", { ...minimalInput, issuerName: "" })).rejects.toThrow();
    expect(db.userSettings.upsert).not.toHaveBeenCalled();
  });

  it("resets a template to default by saving an empty string for it", async () => {
    const db = makeDb();
    await saveUserSettings(db, "user-1", { ...minimalInput, templateSend: "Custom" });

    const result = await saveUserSettings(db, "user-1", { ...minimalInput, templateSend: "" });

    expect(result.templateSend).toBe(DEFAULT_TEMPLATE_SEND);
  });
});
