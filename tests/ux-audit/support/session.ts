import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";

export type UxFixtureManifest = {
  schemaVersion: number;
  prefix: string;
  users: { owner: string; other: string; zero: string; quiet: string };
  sessions: { owner: string; other: string; zero: string; quiet: string };
  quiet: { deal: string; invoice: string };
  deals: {
    masuk: string;
    nego: string;
    deal: string;
    konten: string;
    invoice: string;
    dibayar: string;
    other: string;
    many: string[];
    overdueDeliverable: string;
  };
  invoices: { draft: string; sent: string; due: string; overdue: string; paid: string; other: string };
  publicTokens: { active: string; expired: string; invalid: string };
};

const fixturePath = path.resolve(".hermes-runtime/ux-fixtures/fixtures.json");

export async function loadUxFixtures(): Promise<UxFixtureManifest> {
  return JSON.parse(await readFile(fixturePath, "utf8")) as UxFixtureManifest;
}

export type UxSessionKey = "owner" | "other" | "zero" | "quiet";

// Same cookie-based login used by the T-00/T-27 specs (a real Auth.js
// database-session cookie seeded by scripts/ux-fixtures.ts) -- see
// docs/testing/UX_AUDIT.md for why this harness authenticates this way
// instead of driving the OAuth flow.
export async function loginAs(
  context: BrowserContext,
  baseURL: string,
  fixtures: UxFixtureManifest,
  sessionKey: UxSessionKey,
) {
  const origin = new URL(baseURL);
  await context.clearCookies();
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: fixtures.sessions[sessionKey],
      domain: origin.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function goto200(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  if (response?.status() !== 200) {
    throw new Error(`Expected 200 for ${route}, got ${response?.status() ?? "no response"}`);
  }
  return response;
}
