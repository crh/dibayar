import NextAuth, { type Session } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { recordAuthEvent, type AuthAuditDb } from "@/lib/audit";
import {
  isPilotEmailAllowed,
  isPilotSignInAllowed,
  logPilotConfigProblem,
  readPilotAccessConfig,
} from "@/lib/pilot-access";
import { prisma } from "@/lib/prisma";

const auditDb = prisma as unknown as AuthAuditDb;

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  trustHost: true,
  // AccessDenied (pilot gate) and every other Auth.js error land on one
  // generic page; it never names the account or the allowlist.
  pages: { error: "/akses-terbatas" },
  callbacks: {
    // Runs before Auth.js creates the User/Account rows, so a denied
    // Google account leaves nothing behind.
    signIn({ user, account, profile }) {
      const config = readPilotAccessConfig();
      logPilotConfigProblem(config);
      const allowed = isPilotSignInAllowed({
        config,
        provider: account?.provider,
        userEmail: user?.email,
        profileEmail: profile?.email,
        profileEmailVerified: profile?.email_verified,
      });
      if (!allowed) console.warn("[pilot-access] sign-in denied");
      return allowed;
    },
    // Every auth() call and /api/auth/session pass through here, so an
    // existing session for an account that is (no longer) allowlisted is
    // denied on its next request. `user: null` must stay explicit: the
    // server-side auth() wraps this callback as `{ user, ...session }`
    // (next-auth lib/index.js getSession), so a missing key would put the
    // full database user back.
    session({ session, user }) {
      const config = readPilotAccessConfig();
      logPilotConfigProblem(config);
      if (!user?.id || !isPilotEmailAllowed(config, user.email)) {
        return { expires: session.expires, user: null, pilotAccessDenied: true } as unknown as typeof session;
      }
      return {
        expires: session.expires,
        user: { id: user.id, name: user.name ?? null, email: user.email, image: user.image ?? null },
      } as typeof session;
    },
  },
  events: {
    async signIn({ user, account }) {
      await recordAuthEvent(auditDb, {
        userId: user.id,
        type: "SIGN_IN",
        provider: account?.provider,
      });
    },
    async signOut(event) {
      const userId = "token" in event ? event.token?.sub : event.session?.userId;
      await recordAuthEvent(auditDb, {
        userId,
        type: "SIGN_OUT",
      });
    },
    async linkAccount({ user, account }) {
      await recordAuthEvent(auditDb, {
        userId: user.id,
        type: "ACCOUNT_LINK",
        provider: account.provider,
      });
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

// The only session lookup the app uses. A session the pilot gate denied
// comes back with no user at all, whatever next-auth merges in, so every
// `session?.user?.id` check treats it as signed out; the layout reads
// `pilotAccessDenied` to show the invite-only page instead of sign-in.
export async function auth(): Promise<Session | null> {
  const session = await nextAuth.auth();
  if (!session) return null;
  if (session.pilotAccessDenied) {
    return { expires: session.expires, pilotAccessDenied: true } as unknown as Session;
  }
  return session.user?.id ? session : null;
}
