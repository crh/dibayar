// Seeds the disposable local test database once per E2E run (see
// scripts/e2e-fixtures.ts for the guardrails and exact rows). Runs as a
// child process rather than an in-process import so its own Prisma client
// lifecycle stays fully isolated from Playwright's test workers.
import { execFileSync } from "node:child_process";

export default function globalSetup(): void {
  const env = { ...process.env, E2E_FIXTURE_CONFIRM: "non-production" };
  execFileSync("npx", ["tsx", "--env-file-if-exists=.env.local", "scripts/e2e-fixtures.ts", "seed"], { stdio: "inherit", env });
}
