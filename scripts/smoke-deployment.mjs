#!/usr/bin/env node
// Non-destructive deployment smoke check. Reads only; never writes application
// data, never creates sessions, never uses real credentials. Requires an
// explicit --env and --url so it can never silently default to Production.
//
// Usage:
//   node scripts/smoke-deployment.mjs --env preview --url https://dibayar-xxxxx.vercel.app
//   node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app
//
// Prints a DEPLOYMENT VERIFICATION RECORD block (see DEPLOYMENT.md) for the
// operator to paste into a report. COMMIT_SHA / DEPLOYED_AT are left blank
// for the operator to fill in from `vercel inspect <url>` unless VERCEL_TOKEN
// access is already configured in this shell — this script never reads or
// requires Vercel credentials itself.

function parseArgs(argv) {
  const args = { env: null, url: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') args.env = argv[++i];
    else if (argv[i] === '--url') args.url = argv[++i];
  }
  return args;
}

function usageAndExit(message) {
  if (message) console.error(`ERROR: ${message}\n`);
  console.error(
    'Usage: node scripts/smoke-deployment.mjs --env <preview|production> --url <https://...>\n' +
      'Both --env and --url are required. There is no default target.',
  );
  process.exit(2);
}

async function checkUrl(label, url, expect) {
  const result = { label, url, ok: false, status: null, detail: '' };
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    result.status = res.status;
    result.ok = expect(res.status);
    result.detail = res.headers.get('location')
      ? `location: ${res.headers.get('location')}`
      : '';
  } catch (err) {
    result.detail = `request failed: ${err.message}`;
  }
  return result;
}

async function main() {
  const { env, url } = parseArgs(process.argv.slice(2));
  if (!env || !['preview', 'production'].includes(env)) {
    usageAndExit('--env must be exactly "preview" or "production"');
  }
  if (!url || !/^https:\/\//.test(url)) {
    usageAndExit('--url must be an explicit https:// deployment URL');
  }
  const base = url.replace(/\/$/, '');

  console.log(`Smoke-checking ${env} at ${base} (read-only, no writes)\n`);

  const checks = [];

  // 1. Root responds at all, and unauthenticated behavior is a redirect to
  //    sign-in rather than a 5xx error page.
  checks.push(
    await checkUrl('root (/)', `${base}/`, (s) => s === 307 || s === 302 || (s >= 200 && s < 300)),
  );

  // 2. Auth.js sign-in entrypoint renders without an auth-config error.
  checks.push(await checkUrl('auth signin (/api/auth/signin)', `${base}/api/auth/signin`, (s) => s === 200));

  // 3. Auth.js providers/csrf JSON endpoints are cheap, read-only, and will
  //    themselves 500 with the same MissingSecret-style error class this
  //    incident hit if AUTH_SECRET/provider config is missing.
  checks.push(await checkUrl('auth providers (/api/auth/providers)', `${base}/api/auth/providers`, (s) => s === 200));
  checks.push(await checkUrl('auth csrf (/api/auth/csrf)', `${base}/api/auth/csrf`, (s) => s === 200));

  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? 'PASS' : 'FAIL';
    if (!c.ok) allOk = false;
    console.log(`  [${mark}] ${c.label} -> ${c.status ?? 'no response'} ${c.detail}`);
  }

  console.log(
    '\nNOTE: Database-backed health is NOT independently checked by this script — the ' +
      'repository has no dedicated unauthenticated health endpoint (e.g. a `SELECT 1`-backed ' +
      '/api/health route), and probing real data routes would require a real invoice token or ' +
      'a real authenticated session, both out of scope for a non-destructive automated smoke ' +
      'check. The closest available signal is the migration summary in the deployment\'s own ' +
      'build log (`vercel inspect <url> --logs`), which must be checked manually. Consider ' +
      'adding a minimal DB-backed health endpoint as follow-up work.',
  );

  console.log('\n--- DEPLOYMENT VERIFICATION RECORD (fill in blanks manually) ---');
  console.log(`ENVIRONMENT=${env}`);
  console.log('COMMIT_SHA=');
  console.log(`DEPLOYMENT_URL=${base}`);
  console.log(`DEPLOYED_AT=`);
  console.log(`AUTH_STATUS=${allOk ? 'OK (signin/providers/csrf all responded normally)' : 'FAIL — see checks above'}`);
  console.log('DATABASE_CONNECTIVITY=NOT_CHECKED (no safe endpoint available — see note above)');
  console.log('MIGRATION_STATUS=NOT_CHECKED (cross-check `vercel inspect <url> --logs` manually)');
  console.log(`SMOKE_TEST_STATUS=${allOk ? 'PASS' : 'FAIL'}`);
  console.log('VERIFIED_BY=');
  console.log('--- END RECORD ---\n');

  if (!allOk) process.exit(1);
}

main();
