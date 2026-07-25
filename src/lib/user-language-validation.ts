import { z } from "zod";
import { LANGUAGES } from "./i18n";

export const userLanguageUpdateSchema = z.object({
  language: z.enum(LANGUAGES),
});

export type UserLanguageUpdateInput = z.infer<typeof userLanguageUpdateSchema>;
