import { Prisma } from "@/generated/prisma/client";
import { IDEMPOTENCY_HEADER } from "./mutation";

// A create the page may send more than once for one submission (#53): after
// a timeout, a dropped connection or a gateway error, the page cannot know
// whether the first request was stored, so it sends the same request again
// with the same key. The key is stored on the row under a unique
// (userId, idempotencyKey) index, so a repeat returns the stored row instead
// of writing a second one -- also when the first request has not committed
// yet: the second insert waits on the index for the first transaction, then
// fails as a duplicate and reads the winner.

// The page sends crypto.randomUUID(); anything of that shape is accepted.
const KEY_PATTERN = /^[A-Za-z0-9-]{16,100}$/;

export type IdempotencyKeyRead = { ok: true; key: string | null } | { ok: false };

export function readIdempotencyKey(request: Request): IdempotencyKeyRead {
  const key = request.headers.get(IDEMPOTENCY_HEADER);
  if (key === null) return { ok: true, key: null };
  return KEY_PATTERN.test(key) ? { ok: true, key } : { ok: false };
}

// The key was already used for a request with different content. Not a
// repeat of the same submission, so the stored row is not returned.
export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key reused for a different request.");
    this.name = "IdempotencyConflictError";
  }
}

export type CreateOnceResult<T> = { record: T; replayed: boolean };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// find: the row already stored under this user's key, if any.
// create: writes the row with the key. A unique violation with no row
// under the key is some other constraint and is rethrown.
export async function createOnce<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
  sameRequest: (stored: T) => boolean,
): Promise<CreateOnceResult<T>> {
  const replay = (stored: T): CreateOnceResult<T> => {
    if (!sameRequest(stored)) throw new IdempotencyConflictError();
    return { record: stored, replayed: true };
  };

  const stored = await find();
  if (stored) return replay(stored);

  try {
    return { record: await create(), replayed: false };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await find();
    if (!winner) throw error;
    return replay(winner);
  }
}
