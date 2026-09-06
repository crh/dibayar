// Cleans up the fixture rows created by global-setup.ts. Set
// E2E_KEEP_FIXTURES=1 to skip this and leave the seeded data in place for
// manual debugging after a local `npm run test:e2e` run.
import { execFileSync } from "node:child_process";

export default function globalTeardown(): void {
  if (process.env.E2E_KEEP_FIXTURES === "1") return;
  const env = { ...process.env, E2E_FIXTURE_CONFIRM: "non-production" };
  execFileSync("npx", ["tsx", "--env-file-if-exists=.env.local", "scripts/e2e-fixtures.ts", "cleanup"], { stdio: "inherit", env });
}
