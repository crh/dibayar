import { z } from "zod";

// Zod v4's JIT-compiled validators probe eval support via `new Function("")`
// (zod's `allowsEval`, memoised on first use). The throw is caught, but
// under a strict CSP without `unsafe-eval` the probe still produces a
// `securitypolicyviolation` console entry -- Firefox surfaces it as a
// console error, which broke this app's browserDiagnostics-gated E2E specs
// (zod issues #4461, #5414). `jitless` skips the probe entirely and falls
// back to interpreted validation, which this app's request-sized payloads
// don't need JIT speed for. Must run before any zod schema is first parsed
// in a given JS runtime (server and browser are separate runtimes, so this
// needs importing for its side effect in both).
z.config({ jitless: true });
