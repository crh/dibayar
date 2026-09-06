#!/usr/bin/env node
// `npm run lint` wrapper.
//
// Why this exists: `npm run <script>` always prints an npm lifecycle banner
// ("> dibayar@0.1.0 lint\n> ...") onto the child's stdout before the child
// ever runs, and plain `eslint` (no --format) prints nothing at all to
// stdout on a clean run. Combined, a caller that expects `npm run lint`'s
// stdout to be strict JSON gets either banner text or a genuinely empty
// stream -- both fail to parse (an empty stream fails as "EOF while parsing
// a value"). The project .npmrc silences the npm banner; this script
// supplies the other half by always emitting ESLint's own `json` formatter
// output on stdout, which is valid JSON on every run, clean or not.
//
// Human-readable reporting isn't dropped: the `stylish` formatter's output
// (empty on a clean run, the usual per-file listing otherwise) goes to
// stderr, so an interactive terminal still shows readable lint output.
import { ESLint } from "eslint";
import { pathToFileURL } from "node:url";

// Pure function of ESLint's Node API result shape, exported for direct unit
// testing without invoking ESLint itself. Mirrors the ESLint CLI's own exit
// code contract: 1 when any linted file has an error-level message, 0
// otherwise (warnings alone do not fail the run, matching plain `eslint .`
// with no --max-warnings flag). A fatal error before results exist -- a
// broken config, for instance -- is handled separately in main() as exit 2,
// since that path never produces a results array at all.
export function exitCodeForResults(results) {
  const hasError = results.some((result) => result.errorCount > 0);
  return hasError ? 1 : 0;
}

async function main() {
  let eslint;
  let results;
  try {
    eslint = new ESLint();
    results = await eslint.lintFiles(["."]);
  } catch (error) {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 2;
    return;
  }

  const stylish = await eslint.loadFormatter("stylish");
  const stylishOutput = await stylish.format(results);
  if (stylishOutput.trim().length > 0) {
    console.error(stylishOutput);
  }

  const json = await eslint.loadFormatter("json");
  console.log(await json.format(results));

  process.exitCode = exitCodeForResults(results);
}

const isDirectRun = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main();
}
