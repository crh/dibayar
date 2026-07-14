export type AuthAuditEvent = {
  userId?: string;
  type: "SIGN_IN" | "SIGN_OUT" | "ACCOUNT_LINK";
  provider?: string;
};

export type AuthAuditDb = {
  authEvent: {
    create(args: { data: Omit<AuthAuditEvent, "userId"> & { userId: string } }): Promise<unknown>;
  };
};

export async function recordAuthEvent(db: AuthAuditDb, event: AuthAuditEvent) {
  if (!event.userId) return;

  await db.authEvent.create({
    data: {
      userId: event.userId,
      type: event.type,
      ...(event.provider ? { provider: event.provider } : {}),
    },
  });
}
