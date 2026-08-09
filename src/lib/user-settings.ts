import {
  DEFAULT_TEMPLATE_CHASE,
  DEFAULT_TEMPLATE_SEND,
  userSettingsInputSchema,
  type UserSettingsInput,
} from "./user-settings-validation";

export type UserSettingsRecord = {
  issuerName: string | null;
  issuerAddress: string | null;
  issuerWhatsapp: string | null;
  issuerEmail: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  templateSend: string | null;
  templateChase: string | null;
  updatedAt: Date;
};

// The read/write shape handed to callers: unset text fields resolve to ""
// (never null) so a form can bind directly to it, and unset templates
// resolve to the spec default so the editor always has something to show
// and "reset" is just "save with this field empty".
export type UserSettingsView = {
  issuerName: string;
  issuerAddress: string;
  issuerWhatsapp: string;
  issuerEmail: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  templateSend: string;
  templateChase: string;
  updatedAt: Date | null;
};

type UserSettingsWriteData = Omit<UserSettingsRecord, "updatedAt">;

type UserSettingsModel = {
  findUnique(args: { where: { userId: string } }): Promise<UserSettingsRecord | null>;
  upsert(args: {
    where: { userId: string };
    create: UserSettingsWriteData & { userId: string };
    update: UserSettingsWriteData;
  }): Promise<UserSettingsRecord>;
};

export type UserSettingsDb = { userSettings: UserSettingsModel };

function toView(record: UserSettingsRecord | null): UserSettingsView {
  return {
    issuerName: record?.issuerName ?? "",
    issuerAddress: record?.issuerAddress ?? "",
    issuerWhatsapp: record?.issuerWhatsapp ?? "",
    issuerEmail: record?.issuerEmail ?? "",
    bankName: record?.bankName ?? "",
    bankAccountNumber: record?.bankAccountNumber ?? "",
    bankAccountHolder: record?.bankAccountHolder ?? "",
    templateSend: record?.templateSend ?? DEFAULT_TEMPLATE_SEND,
    templateChase: record?.templateChase ?? DEFAULT_TEMPLATE_CHASE,
    updatedAt: record?.updatedAt ?? null,
  };
}

function toWriteData(input: UserSettingsInput): UserSettingsWriteData {
  return {
    issuerName: input.issuerName,
    issuerAddress: input.issuerAddress ?? null,
    issuerWhatsapp: input.issuerWhatsapp ?? null,
    issuerEmail: input.issuerEmail ?? null,
    bankName: input.bankName,
    bankAccountNumber: input.bankAccountNumber,
    bankAccountHolder: input.bankAccountHolder,
    templateSend: input.templateSend ?? null,
    templateChase: input.templateChase ?? null,
  };
}

// Returns the caller's own settings view, or the all-defaults view when the
// user has never saved a row — never a null/not-found signal, since a
// missing row is an expected, valid state (see schema.prisma UserSettings).
export async function getUserSettings(db: UserSettingsDb, userId: string): Promise<UserSettingsView> {
  const record = await db.userSettings.findUnique({ where: { userId } });
  return toView(record);
}

// Always a full save, not a partial patch: the required fields (issuerName,
// bank*) must be present on every call, matching the single settings form
// this backs. Upsert makes create-vs-update transparent to the caller and
// keyed strictly on the caller's own id (never a client-supplied one).
export async function saveUserSettings(
  db: UserSettingsDb,
  userId: string,
  input: unknown,
): Promise<UserSettingsView> {
  const validated = userSettingsInputSchema.parse(input);
  const data = toWriteData(validated);

  const record = await db.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return toView(record);
}
