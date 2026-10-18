import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    // Set (with no user) when the session's account is not on the pilot
    // allowlist; see src/auth.ts.
    pilotAccessDenied?: true;
  }
}
