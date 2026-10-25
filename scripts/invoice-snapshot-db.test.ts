// Real-PostgreSQL checks for the Decision A invoice snapshot (issue #55):
// the migration against a populated old-schema database, its backfill and
// provenance, idempotence, the immutability trigger, and the app's own
// freeze statement (src/lib/invoice-snapshot.ts) under concurrency, retry,
// rollback and a foreign owner. Unit tests mock the database and cannot see
// any of this.
//
// Runs only against the approved disposable target (127.0.0.1:55432/
// dibayar_test, the same guard as scripts/e2e-fixtures.ts), and only inside
// a throwaway schema it creates and drops itself: the old migrations are
// replayed into that schema, legacy rows are written there, then the new
// migration is applied. Nothing outside that schema is read or written.
//
//   npm run test:snapshot-db
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { freezeInvoiceDocument, type InvoiceSnapshotWriteClient } from "../src/lib/invoice-snapshot";

const SNAPSHOT_MIGRATION = "20261018000000_invoice_document_snapshot";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required; no database action was taken");
const url = new URL(connectionString);
const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
if (!/^postgres(ql)?:$/.test(url.protocol) || host !== "127.0.0.1" || url.port !== "55432" || decodeURIComponent(url.pathname.slice(1)) !== "dibayar_test") {
  throw new Error("Refusing database action: target must be 127.0.0.1:55432/dibayar_test");
}
url.searchParams.delete("schema");

const schema = `snapshot_test_${randomBytes(6).toString("hex")}`;
let admin: pg.Client;
let pool: pg.Pool;

// The app's freeze statement, run through pg instead of Prisma: Prisma.sql's
// `text` is the same statement with $n placeholders.
const app: InvoiceSnapshotWriteClient = {
  $executeRaw: (async (query: { text: string; values: unknown[] }) => {
    const result = await pool.query(query.text, query.values);
    return result.rowCount ?? 0;
  }) as unknown as InvoiceSnapshotWriteClient["$executeRaw"],
};

function onClient(client: pg.PoolClient): InvoiceSnapshotWriteClient {
  return {
    $executeRaw: (async (query: { text: string; values: unknown[] }) => (await client.query(query.text, query.values)).rowCount ?? 0) as unknown as InvoiceSnapshotWriteClient["$executeRaw"],
  };
}

async function migrationSql(name: string) {
  return readFile(path.resolve("prisma/migrations", name, "migration.sql"), "utf8");
}

async function snapshotOf(invoiceId: string) {
  const { rows } = await pool.query(`SELECT * FROM "InvoiceSnapshot" WHERE "invoiceId" = $1`, [invoiceId]);
  return rows[0] ?? null;
}

async function snapshotCount(invoiceId: string) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "InvoiceSnapshot" WHERE "invoiceId" = $1`, [invoiceId]);
  return rows[0].n as number;
}

const T0 = "2026-09-01 00:00:00";

async function seedUser(id: string, settings: boolean) {
  await pool.query(`INSERT INTO "User" ("id", "updatedAt") VALUES ($1, now())`, [id]);
  if (settings) {
    await pool.query(
      `INSERT INTO "UserSettings" ("id", "userId", "issuerName", "issuerAddress", "issuerWhatsapp", "issuerEmail", "bankName", "bankAccountNumber", "bankAccountHolder", "updatedAt")
       VALUES ($1, $2, 'Penerbit Asli', 'Jl. Asli 1', '628100000001', 'asli@example.invalid', 'Bank Asli', '1112223334', 'Pemilik Asli', $3)`,
      [`${id}-settings`, id, T0],
    );
  }
}

async function seedInvoice(options: { id: string; userId: string; status: string; share?: "active" | "expired"; contactName?: string | null; paymentTerms?: string | null }) {
  const dealId = `${options.id}-deal`;
  await pool.query(
    `INSERT INTO "Deal" ("id", "userId", "brand", "contactWa", "contactName", "scope", "feeIdr", "paymentTerms", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, '628110000000', $4, $5, 1500000, $6, 'INVOICE', $7, $7)`,
    [dealId, options.userId, `Brand ${options.id}`, options.contactName ?? null, `Scope ${options.id}`, options.paymentTerms ?? null, T0],
  );
  await pool.query(
    `INSERT INTO "Invoice" ("id", "userId", "dealId", "number", "subtotalIdr", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 1500000, $5::"InvoiceStatus", $6, $6)`,
    [options.id, options.userId, dealId, `INV/${options.id}`, options.status, T0],
  );
  if (options.share) {
    await pool.query(
      `INSERT INTO "InvoiceShare" ("id", "invoiceId", "tokenHash", "expiresAt", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
      [`${options.id}-share`, options.id, `hash-${options.id}`, options.share === "active" ? "2099-01-01" : "2000-01-01"],
    );
  }
  return dealId;
}

before(async () => {
  admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  pool = new pg.Pool({ connectionString: url.toString(), max: 10, options: `-c search_path="${schema}"` });

  // Every migration before this one, in order: a database as it is before
  // the release.
  const names = (await readdir(path.resolve("prisma/migrations"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.ok(names.includes(SNAPSHOT_MIGRATION), "snapshot migration is checked in");
  for (const name of names.filter((candidate) => candidate < SNAPSHOT_MIGRATION)) {
    await pool.query((await migrationSql(name)).replace(/CREATE SCHEMA IF NOT EXISTS "public";/, ""));
  }

  // Legacy data written by the previous app version.
  await seedUser("owner", true);
  await seedUser("bare", false);
  await seedInvoice({ id: "draft", userId: "owner", status: "DRAFT" });
  await seedInvoice({ id: "draft-shared", userId: "owner", status: "DRAFT", share: "active", contactName: "Kontak Asli" });
  await seedInvoice({ id: "sent", userId: "owner", status: "SENT", share: "active", paymentTerms: "Termin asli" });
  await seedInvoice({ id: "paid-expired", userId: "owner", status: "PAID", share: "expired" });
  await seedInvoice({ id: "overdue-unshared", userId: "owner", status: "OVERDUE" });
  await seedInvoice({ id: "bare-sent", userId: "bare", status: "SENT" });

  await pool.query(await migrationSql(SNAPSHOT_MIGRATION));
});

after(async () => {
  await pool?.end();
  await admin?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin?.end();
});

describe("migration backfill (populated old-schema database)", () => {
  it("snapshots every exposed invoice -- left DRAFT, or has any share row -- and leaves an unshared Draft live", async () => {
    for (const id of ["draft-shared", "sent", "paid-expired", "overdue-unshared", "bare-sent"]) {
      assert.equal(await snapshotCount(id), 1, `${id} has one snapshot`);
    }
    assert.equal(await snapshotCount("draft"), 0, "an unshared Draft is not frozen");
  });

  it("labels backfilled rows as reconstructed at migration, never as captured on issue", async () => {
    const { rows } = await pool.query(`SELECT DISTINCT "provenance"::text, "trigger"::text FROM "InvoiceSnapshot"`);
    assert.deepEqual(rows, [{ provenance: "RECONSTRUCTED_ON_MIGRATION", trigger: "MIGRATION" }]);
  });

  it("copies the current deal and Settings values exactly, and records their updatedAt as evidence", async () => {
    const sent = await snapshotOf("sent");
    assert.equal(sent.brand, "Brand sent");
    assert.equal(sent.scope, "Scope sent");
    assert.equal(sent.paymentTerms, "Termin asli");
    assert.equal(sent.contactName, null);
    assert.equal(sent.issuerSettingsPresent, true);
    assert.equal(sent.issuerName, "Penerbit Asli");
    assert.equal(sent.bankAccountNumber, "1112223334");
    const { rows } = await pool.query(`SELECT d."updatedAt" AS deal, s."updatedAt" AS settings FROM "Deal" d, "UserSettings" s WHERE d."id" = 'sent-deal' AND s."userId" = 'owner'`);
    assert.equal(new Date(sent.sourceDealUpdatedAt).getTime(), new Date(rows[0].deal).getTime());
    assert.equal(new Date(sent.sourceSettingsUpdatedAt).getTime(), new Date(rows[0].settings).getTime());
    assert.equal((await snapshotOf("draft-shared")).contactName, "Kontak Asli");
  });

  it("invents nothing for an owner with no Settings row", async () => {
    const bare = await snapshotOf("bare-sent");
    assert.equal(bare.issuerSettingsPresent, false);
    for (const column of ["issuerName", "issuerAddress", "issuerWhatsapp", "issuerEmail", "bankName", "bankAccountNumber", "bankAccountHolder", "sourceSettingsUpdatedAt"]) {
      assert.equal(bare[column], null, `${column} stays null`);
    }
  });

  it("re-running the backfill writes nothing and changes nothing", async () => {
    const sql = await migrationSql(SNAPSHOT_MIGRATION);
    const backfill = sql.slice(sql.indexOf("INSERT INTO \"InvoiceSnapshot\""));
    const before = (await pool.query(`SELECT * FROM "InvoiceSnapshot" ORDER BY "invoiceId"`)).rows;
    await pool.query(`UPDATE "Deal" SET "brand" = 'Brand diubah' WHERE "id" = 'sent-deal'`);

    const result = await pool.query(backfill);

    assert.equal(result.rowCount, 0);
    assert.deepEqual((await pool.query(`SELECT * FROM "InvoiceSnapshot" ORDER BY "invoiceId"`)).rows, before);
  });
});

describe("immutability", () => {
  it("the database rejects any UPDATE of a snapshot", async () => {
    await assert.rejects(
      pool.query(`UPDATE "InvoiceSnapshot" SET "brand" = 'Ditulis ulang' WHERE "invoiceId" = 'sent'`),
      (error: { code?: string; message?: string }) => error.code === "23001" && /immutable/.test(error.message ?? ""),
    );
    assert.equal((await snapshotOf("sent")).brand, "Brand sent");
  });

  it("deal and Settings edits after the freeze leave the snapshot as it was", async () => {
    const before = await snapshotOf("paid-expired");
    await pool.query(`UPDATE "Deal" SET "brand" = 'Brand baru', "scope" = 'Scope baru', "contactName" = 'Kontak baru', "paymentTerms" = 'Termin baru', "updatedAt" = now() WHERE "id" = 'paid-expired-deal'`);
    await pool.query(`UPDATE "UserSettings" SET "bankName" = 'Bank Baru', "issuerName" = 'Penerbit Baru', "updatedAt" = now() WHERE "userId" = 'owner'`);
    await freezeInvoiceDocument(app, "paid-expired", "owner", "STATUS_CHANGE");

    assert.deepEqual(await snapshotOf("paid-expired"), before);
  });

  it("a status move back (PAID to SENT) and a revoked share do not thaw it", async () => {
    const before = await snapshotOf("paid-expired");
    await pool.query(`UPDATE "Invoice" SET "status" = 'SENT' WHERE "id" = 'paid-expired'`);
    await pool.query(`DELETE FROM "InvoiceShare" WHERE "invoiceId" = 'paid-expired'`);

    assert.deepEqual(await snapshotOf("paid-expired"), before);
  });

  it("deleting the invoice still cascades (an account deletion is not blocked)", async () => {
    await seedInvoice({ id: "to-delete", userId: "owner", status: "SENT" });
    await freezeInvoiceDocument(app, "to-delete", "owner", "STATUS_CHANGE");
    assert.equal(await snapshotCount("to-delete"), 1);

    await pool.query(`DELETE FROM "Invoice" WHERE "id" = 'to-delete'`);

    assert.equal(await snapshotCount("to-delete"), 0);
  });
});

describe("the app's freeze statement", () => {
  it("captures a Draft at issue as CAPTURED_ON_ISSUE, with the deal and Settings of that moment", async () => {
    await pool.query(`UPDATE "Deal" SET "brand" = 'Brand saat terbit' WHERE "id" = 'draft-deal'`);

    assert.equal(await freezeInvoiceDocument(app, "draft", "owner", "STATUS_CHANGE"), 1);

    const snapshot = await snapshotOf("draft");
    assert.equal(snapshot.provenance, "CAPTURED_ON_ISSUE");
    assert.equal(snapshot.trigger, "STATUS_CHANGE");
    assert.equal(snapshot.brand, "Brand saat terbit");
    assert.equal(snapshot.bankName, "Bank Baru");
  });

  it("labels a Draft that already had a link but no snapshot as RECONSTRUCTED_LATE", async () => {
    await seedInvoice({ id: "late-draft", userId: "owner", status: "DRAFT", share: "active" });

    await freezeInvoiceDocument(app, "late-draft", "owner", "SHARE_LINK");

    assert.equal((await snapshotOf("late-draft")).provenance, "RECONSTRUCTED_LATE");
  });

  it("is exactly-once under concurrent exposure (status change and share links racing)", async () => {
    await seedInvoice({ id: "race", userId: "owner", status: "DRAFT" });
    const triggers = ["STATUS_CHANGE", "SHARE_LINK", "SHARE_LINK", "STATUS_CHANGE", "SHARE_LINK", "DOCUMENT_READ", "SHARE_LINK", "STATUS_CHANGE"] as const;

    const written = await Promise.all(triggers.map(async (trigger) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const count = await freezeInvoiceDocument(onClient(client), "race", "owner", trigger);
        await client.query("SELECT pg_sleep(0.05)");
        await client.query("COMMIT");
        return count;
      } finally {
        client.release();
      }
    }));

    assert.equal(written.reduce((sum, count) => sum + count, 0), 1);
    assert.equal(await snapshotCount("race"), 1);
    assert.equal((await snapshotOf("race")).provenance, "CAPTURED_ON_ISSUE");
  });

  it("a retry after the first freeze is a no-op that keeps the original copy", async () => {
    const first = await snapshotOf("race");
    await pool.query(`UPDATE "Deal" SET "brand" = 'Brand setelah retry' WHERE "id" = 'race-deal'`);

    assert.equal(await freezeInvoiceDocument(app, "race", "owner", "SHARE_LINK"), 0);
    assert.deepEqual(await snapshotOf("race"), first);
  });

  it("rolls back with the transaction it belongs to (no snapshot without its exposure)", async () => {
    await seedInvoice({ id: "rolled-back", userId: "owner", status: "DRAFT" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      assert.equal(await freezeInvoiceDocument(onClient(client), "rolled-back", "owner", "STATUS_CHANGE"), 1);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    assert.equal(await snapshotCount("rolled-back"), 0);
  });

  it("writes nothing for another user's invoice", async () => {
    await seedInvoice({ id: "owner-only", userId: "owner", status: "DRAFT" });

    assert.equal(await freezeInvoiceDocument(app, "owner-only", "bare", "SHARE_LINK"), 0);
    assert.equal(await snapshotCount("owner-only"), 0);
  });
});
