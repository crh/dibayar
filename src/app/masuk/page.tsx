import { cookies } from "next/headers";
import { getLanguage } from "@/lib/i18n";
import LandingClient from "../landing-client";

const LANGUAGE_COOKIE = "dibayar-language";

export default async function Home() {
  const cookieStore = await cookies();
  const language = getLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);

  return <LandingClient initialLanguage={language} />;
}
