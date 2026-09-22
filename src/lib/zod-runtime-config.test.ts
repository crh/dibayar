import { describe, expect, it } from "vitest";
import * as core from "zod/v4/core";

// Regression test for the Firefox CSP finding: zod's `allowsEval` probe
// (`new Function("")`, memoised) still logs a securitypolicyviolation
// console error under a strict CSP even though the throw is caught (zod
// issues #4461, #5414). Importing src/lib/zod-runtime-config.ts sets
// `jitless: true`, which short-circuits the probe before it ever runs.
// See e2e/invoices/invoice-journeys.spec.ts (--project=firefox) for the
// real-browser confirmation.
describe("zod-runtime-config", () => {
  it("sets jitless so the eval capability probe never runs", async () => {
    const origFunction = globalThis.Function;
    let probeAttempted = false;
    // @ts-expect-error stubbing the global Function constructor for the test
    globalThis.Function = function StubFunction(): never {
      probeAttempted = true;
      throw new Error("allowsEval probe should have been skipped under jitless=true");
    };

    try {
      await import("./zod-runtime-config");
      expect(core.globalConfig.jitless).toBe(true);
      expect(core.util.allowsEval.value).toBe(false);
      expect(probeAttempted).toBe(false);
    } finally {
      globalThis.Function = origFunction;
    }
  });
});
