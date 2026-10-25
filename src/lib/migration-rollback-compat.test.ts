// Guards the secure application-recovery path for the PR #67 release
// (docs/receipts/DIBAYAR-RECOVERY-HARDENING-2026-10-25.md). The recovery
// candidate (branch hotfix/secure-recovery-baseline-2026-10-25: Production's
// code plus the pilot allowlist and the dependency patches) ships only the
// migrations up to RECOVERY_BASELINE, and it was rehearsed against the release
// schema. That stays true only while every later migration is something the
// older code can run on: new tables, nullable or defaulted columns, new
// indexes, triggers on new tables.
//
// A later migration that drops, renames, retypes or tightens existing schema,
// adds an enum value an older client cannot parse, or puts a trigger on an
// existing table breaks that recovery path. It needs a deliberate decision:
// re-cut and re-rehearse the recovery candidate, then mark the migration with
// a line `-- rollback-incompatible: <reason and receipt>`.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations");
// The last migration on main (308a339) and in the recovery candidate.
const RECOVERY_BASELINE = "20260901034508_invoice_share_token_ciphertext";
const OPT_OUT = /^--\s*rollback-incompatible:\s*\S/m;

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

// Returns why the SQL would break an older app version, or [] when it is
// additive. Statements inside a plpgsql function body are ignored.
function rollbackHazards(sql: string): string[] {
  const body = stripComments(sql).replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
  const created = new Set([...body.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)].map((m) => m[1]));
  const hazards: string[] = [];
  const rules: [RegExp, string][] = [
    [/\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA|VIEW)\b/i, "drops existing schema"],
    [/\bRENAME\b/i, "renames existing schema"],
    [/\bALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE\b/i, "changes a column type"],
    [/\bALTER\s+COLUMN\s+"?\w+"?\s+SET\s+NOT\s+NULL\b/i, "makes an existing column required"],
    [/\bALTER\s+TYPE\s+"?\w+"?\s+ADD\s+VALUE\b/i, "adds an enum value an older client cannot read"],
    [/\bTRUNCATE\b/i, "truncates data"],
    [/\bDELETE\s+FROM\b/i, "deletes data"],
  ];
  for (const [pattern, reason] of rules) if (pattern.test(body)) hazards.push(reason);

  for (const m of body.matchAll(/ALTER\s+TABLE\s+"?(\w+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?\w+"?\s+([^,;]*)/gi)) {
    const definition = m[2];
    if (/\bNOT\s+NULL\b/i.test(definition) && !/\bDEFAULT\b/i.test(definition) && !created.has(m[1])) {
      hazards.push(`adds a required column without a default to "${m[1]}"`);
    }
  }
  for (const m of body.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+"?\w+"?[\s\S]*?\bON\s+"?(\w+)"?/gi)) {
    if (!created.has(m[1])) hazards.push(`adds a trigger to existing table "${m[1]}"`);
  }
  return hazards;
}

function migrationsAfterBaseline() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name > RECOVERY_BASELINE)
    .map((entry) => entry.name)
    .sort();
}

describe("migrations after the recovery baseline stay rollback-compatible", () => {
  it("still finds the baseline migration", () => {
    expect(readdirSync(MIGRATIONS_DIR)).toContain(RECOVERY_BASELINE);
  });

  it.each(migrationsAfterBaseline())("%s is additive or explicitly marked", (name) => {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
    if (OPT_OUT.test(sql)) return;
    expect(rollbackHazards(sql)).toEqual([]);
  });
});

describe("rollbackHazards", () => {
  it("accepts the additive shapes the release migrations use", () => {
    expect(
      rollbackHazards(`
        ALTER TABLE "Deal" ADD COLUMN "idempotencyKey" TEXT;
        CREATE UNIQUE INDEX "Deal_userId_idempotencyKey_key" ON "Deal"("userId", "idempotencyKey");
        CREATE TYPE "Kind" AS ENUM ('A', 'B');
        CREATE TABLE "Snap" ("id" TEXT NOT NULL, "kind" "Kind" NOT NULL);
        ALTER TABLE "Deal" ADD COLUMN "flag" BOOLEAN NOT NULL DEFAULT false;
        CREATE FUNCTION "reject"() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN DELETE FROM x; RAISE EXCEPTION 'no'; END; $$;
        CREATE TRIGGER "Snap_immutable" BEFORE UPDATE ON "Snap" FOR EACH ROW EXECUTE FUNCTION "reject"();
        -- DROP TABLE "Deal" in a comment is ignored
      `),
    ).toEqual([]);
  });

  it.each([
    [`ALTER TABLE "Deal" DROP COLUMN "brand";`, "drops existing schema"],
    [`DROP TABLE "InvoiceShare";`, "drops existing schema"],
    [`ALTER TABLE "Deal" RENAME COLUMN "brand" TO "brandName";`, "renames existing schema"],
    [`ALTER TABLE "Deal" ALTER COLUMN "feeIdr" SET DATA TYPE BIGINT;`, "changes a column type"],
    [`ALTER TABLE "Deal" ALTER COLUMN "contactName" SET NOT NULL;`, "makes an existing column required"],
    [`ALTER TYPE "InvoiceStatus" ADD VALUE 'VOID';`, "adds an enum value an older client cannot read"],
    [`ALTER TABLE "Invoice" ADD COLUMN "currency" TEXT NOT NULL;`, `adds a required column without a default to "Invoice"`],
    [`CREATE TRIGGER "t" BEFORE INSERT ON "Invoice" FOR EACH ROW EXECUTE FUNCTION f();`, `adds a trigger to existing table "Invoice"`],
    [`DELETE FROM "Session";`, "deletes data"],
  ])("flags %s", (sql, reason) => {
    expect(rollbackHazards(sql)).toContain(reason);
  });
});
