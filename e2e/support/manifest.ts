// Reads the manifest written by scripts/e2e-fixtures.ts (seed step). Kept as
// a plain, synchronous JSON read (not a DB query) so every spec file and the
// global setup/teardown agree on exactly the same deterministic IDs without
// re-deriving them.
import { readFileSync } from "node:fs";
import path from "node:path";

export type FixtureManifest = {
  schemaVersion: 1;
  prefix: string;
  host: string;
  port: string;
  database: string;
  owner: { id: string; sessionToken: string; email: string };
  deals: {
    masuk: string;
    nego: string;
    deal: string;
    konten: string;
    invoicePending: string;
    invoiceSent: string;
    dibayar: string;
  };
  brands: Record<string, string>;
  invoices: { sent: string; paid: string };
};

const manifestPath = path.resolve(".hermes-runtime/e2e-fixtures/fixtures.json");

let cached: FixtureManifest | null = null;

export function loadFixtureManifest(): FixtureManifest {
  if (cached) return cached;
  let raw: string;
  try {
    raw = readFileSync(manifestPath, "utf8");
  } catch {
    throw new Error(
      `E2E fixture manifest not found at ${manifestPath}. Run "npm run e2e:seed" first (globalSetup does this automatically for playwright test runs).`,
    );
  }
  cached = JSON.parse(raw) as FixtureManifest;
  return cached;
}
