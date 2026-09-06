import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { recordAuthEvent, type AuthAuditDb } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const auditDb = prisma as unknown as AuthAuditDb;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      if (session.user && user.id) session.user.id = user.id;
      return session;
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
