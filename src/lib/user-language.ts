import { getLanguage, type Language } from "./i18n";

export type UserLanguageDb = {
  user: {
    findUnique(args: { where: { id: string }; select: { language: true } }): Promise<{ language: string } | null>;
    update(args: { where: { id: string }; data: { language: Language } }): Promise<{ language: Language }>;
  };
};

// Returns the default English language (not a throw) when the user row is
// missing, so a caller never has to special-case a not-found lookup here.
export async function getUserLanguage(db: UserLanguageDb, userId: string): Promise<Language> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { language: true } });
  return getLanguage(user?.language);
}

export async function updateUserLanguage(db: UserLanguageDb, userId: string, language: Language): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { language } });
}
