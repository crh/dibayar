import { describe, expect, it, vi } from "vitest";
import { recordAuthEvent, type AuthAuditDb } from "./audit";

describe("auth audit events", () => {
  it("records a sign-in event without storing provider tokens", async () => {
    const db: AuthAuditDb = {
      authEvent: {
        create: vi.fn(async ({ data }) => ({ id: "event-1", ...data })),
      },
    };

    await recordAuthEvent(db, {
      userId: "user-1",
      type: "SIGN_IN",
      provider: "google",
    });

    expect(db.authEvent.create).toHaveBeenCalledWith({
      data: { userId: "user-1", type: "SIGN_IN", provider: "google" },
    });
  });

  it("does not create an audit row without a user id", async () => {
    const db: AuthAuditDb = {
      authEvent: { create: vi.fn() },
    };

    await recordAuthEvent(db, { type: "SIGN_OUT" });

    expect(db.authEvent.create).not.toHaveBeenCalled();
  });
});
