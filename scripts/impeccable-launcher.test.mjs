// Regression tests for the hardened Impeccable launcher
// (.claude/skills/impeccable/scripts/impeccable). See docs/tooling/IMPECCABLE.md.
//
// Nothing here touches the network, the real engine binary or the real
// ~/.impeccable cache: every run uses a throwaway skill directory, a
// throwaway HOME, mock "engines" that are small shell scripts, and a PATH
// made only of the handful of system tools the launcher needs plus shims for
// uname and curl.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scriptsDir = join(here, "..", ".claude", "skills", "impeccable", "scripts");
const launcherSource = readFileSync(join(scriptsDir, "impeccable"), "utf8");
const committedVersion = readFileSync(join(scriptsDir, "VERSION"), "utf8").trim();
const committedManifest = readFileSync(join(scriptsDir, "engine-digests.txt"), "utf8");

const VERSION = "0.1.14";
// System tools the launcher may call. sha256sum, shasum, curl and uname are
// handled per test so they can be replaced or withheld.
const BASE_TOOLS = ["sh", "dirname", "tr", "awk", "head", "chmod", "mkdir", "rm", "mv", "cp", "cat"];

function which(tool) {
  const found = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.trim() : null;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

// A mock engine. Any execution at all appends to $MOCK_EXEC_LOG, so a test can
// prove a candidate was never run, not even for the version probe.
function engineScript(label, reportedVersion) {
  return [
    "#!/bin/sh",
    `echo "${label} $*" >> "$MOCK_EXEC_LOG"`,
    `if [ "\${1:-}" = engine-probe ]; then echo "impeccable-engine ${reportedVersion}"; exit 0; fi`,
    `echo "RAN ${label} $*"`,
    "",
  ].join("\n");
}

let root;
before(() => {
  root = mkdtempSync(join(tmpdir(), "impeccable-launcher-test-"));
});
after(() => {
  rmSync(root, { recursive: true, force: true });
});

let sandboxCount = 0;

// Builds an isolated world: skill dir with the committed launcher, a HOME, and
// a tools dir that becomes the whole PATH.
function sandbox({
  unameS = "Linux",
  unameM = "x86_64",
  hashers = ["sha256sum"],
  manifest,
  version = VERSION,
} = {}) {
  const base = join(root, `case-${++sandboxCount}`);
  const skillScripts = join(base, "skill", "scripts");
  const home = join(base, "home");
  const tools = join(base, "tools");
  const extraPath = join(base, "extra-path");
  for (const dir of [skillScripts, home, tools, extraPath]) mkdirSync(dir, { recursive: true });

  const launcher = join(skillScripts, "impeccable");
  writeFileSync(launcher, launcherSource);
  chmodSync(launcher, 0o755);
  if (version !== null) writeFileSync(join(skillScripts, "VERSION"), `${version}\n`);

  for (const tool of [...BASE_TOOLS, ...hashers]) {
    const real = which(tool);
    assert.ok(real, `test host is missing ${tool}`);
    symlinkSync(real, join(tools, tool));
  }
  writeFileSync(
    join(tools, "uname"),
    `#!/bin/sh\ncase "\${1:-}" in -s) echo "${unameS}" ;; -m) echo "${unameM}" ;; *) echo "${unameS}" ;; esac\n`,
  );
  // curl shim: records every requested URL; serves $FAKE_CURL_SOURCE when set,
  // otherwise fails like an unreachable host. Never touches the network.
  writeFileSync(
    join(tools, "curl"),
    [
      "#!/bin/sh",
      'out=""; url=""',
      'while [ $# -gt 0 ]; do case "$1" in -o) out="$2"; shift ;; --retry) shift ;; -*) ;; *) url="$1" ;; esac; shift; done',
      'echo "$url" >> "$FAKE_CURL_LOG"',
      '[ -n "${FAKE_CURL_SOURCE:-}" ] || exit 22',
      'cp "$FAKE_CURL_SOURCE" "$out"',
      "",
    ].join("\n"),
  );
  chmodSync(join(tools, "uname"), 0o755);
  chmodSync(join(tools, "curl"), 0o755);

  const world = {
    base,
    skillScripts,
    home,
    tools,
    extraPath,
    launcher,
    execLog: join(base, "exec.log"),
    curlLog: join(base, "curl.log"),
    manifestPath: join(skillScripts, "engine-digests.txt"),
    // Writes a mock engine and returns its content digest.
    engine(path, label, reportedVersion = VERSION) {
      const content = engineScript(label, reportedVersion);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
      chmodSync(path, 0o755);
      return sha256(content);
    },
    trust(digest, platform = "linux-x64", forVersion = VERSION) {
      writeFileSync(world.manifestPath, `# test manifest\n${forVersion} ${platform} ${digest}\n`);
    },
    run(args = ["context"], env = {}) {
      const result = spawnSync(world.launcher, args, {
        encoding: "utf8",
        env: {
          PATH: `${tools}:${extraPath}`,
          HOME: home,
          MOCK_EXEC_LOG: world.execLog,
          FAKE_CURL_LOG: world.curlLog,
          ...env,
        },
      });
      return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        executed: existsSync(world.execLog) ? readFileSync(world.execLog, "utf8") : "",
        requested: existsSync(world.curlLog) ? readFileSync(world.curlLog, "utf8") : "",
      };
    },
    paths: {
      sibling: (platform = "linux-x64") => join(skillScripts, "bin", platform, "impeccable"),
      cache: join(home, ".impeccable", "bin", VERSION, "impeccable"),
      homeBin: join(home, ".impeccable", "bin", "impeccable"),
      onPath: join(extraPath, "impeccable"),
      envBin: join(base, "custom", "engine"),
    },
  };
  if (manifest !== undefined) writeFileSync(world.manifestPath, manifest);
  return world;
}

const CANDIDATES = [
  ["bundled sibling binary", (w) => w.paths.sibling(), () => ({})],
  ["version-pinned cache", (w) => w.paths.cache, () => ({})],
  ["unversioned ~/.impeccable/bin/impeccable", (w) => w.paths.homeBin, () => ({})],
  ["impeccable on PATH", (w) => w.paths.onPath, () => ({})],
  ["IMPECCABLE_BIN", (w) => w.paths.envBin, (w) => ({ IMPECCABLE_BIN: w.paths.envBin })],
];

for (const [name, pathOf, envOf] of CANDIDATES) {
  test(`${name}: runs when its digest is committed and it reports the pinned version`, () => {
    const w = sandbox();
    w.trust(w.engine(pathOf(w), "good"));
    const result = w.run(["detect", "--json", "src/"], envOf(w));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "RAN good detect --json src/");
  });

  test(`${name}: a tampered binary is refused and never executed, not even for the probe`, () => {
    const w = sandbox();
    w.engine(pathOf(w), "evil");
    w.trust(sha256("the reviewed binary, which this is not"));
    const result = w.run(["context"], envOf(w));
    assert.equal(result.status, 127);
    assert.equal(result.executed, "", "untrusted candidate must not be executed");
    assert.match(result.stderr, /not the reviewed (digest|engine)/);
    assert.doesNotMatch(result.stdout, /RAN/);
  });

  test(`${name}: an engine reporting 999.0.0 is refused even when its digest is committed`, () => {
    const w = sandbox();
    w.trust(w.engine(pathOf(w), "wrong-version", "999.0.0"));
    const result = w.run(["context"], envOf(w));
    assert.equal(result.status, 127);
    assert.doesNotMatch(result.stdout, /RAN/);
    assert.match(result.stderr, /reports "impeccable-engine 999\.0\.0", expected "impeccable-engine 0\.1\.14"/);
    // Only the probe ran; the requested command never did.
    assert.equal(result.executed.trim(), "wrong-version engine-probe");
  });
}

test("a version-prefix lookalike (0.1.140) is refused", () => {
  const w = sandbox();
  w.trust(w.engine(w.paths.sibling(), "lookalike", "0.1.140"));
  const result = w.run();
  assert.equal(result.status, 127);
  assert.doesNotMatch(result.stdout, /RAN/);
});

test("a tampered IMPECCABLE_BIN stops the launcher instead of falling through to another engine", () => {
  const w = sandbox();
  w.trust(w.engine(w.paths.sibling(), "good"));
  w.engine(w.paths.envBin, "evil");
  const result = w.run(["context"], { IMPECCABLE_BIN: w.paths.envBin });
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.match(result.stderr, /IMPECCABLE_BIN is set but is not the reviewed engine/);
});

test("a tampered cache is skipped and a trusted candidate later in the order still runs", () => {
  const w = sandbox();
  w.engine(w.paths.cache, "evil-cache");
  w.trust(w.engine(w.paths.homeBin, "good-home"));
  const result = w.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "RAN good-home context");
  assert.doesNotMatch(result.executed, /evil-cache/);
});

test("missing manifest: fails closed without running a present engine", () => {
  const w = sandbox();
  w.engine(w.paths.sibling(), "good");
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.match(result.stderr, /missing trust manifest/);
  assert.equal(result.requested, "", "must not attempt a download");
});

test("no digest for this platform: fails closed without running or downloading", () => {
  const w = sandbox();
  const digest = w.engine(w.paths.sibling(), "good");
  w.trust(digest, "darwin-arm64");
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.equal(result.requested, "");
  assert.match(result.stderr, /no reviewed digest for engine 0\.1\.14 on linux-x64/);
});

test("digest committed only for another engine version: fails closed", () => {
  const w = sandbox();
  const digest = w.engine(w.paths.sibling(), "good");
  w.trust(digest, "linux-x64", "0.1.13");
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
});

test("malformed manifest entry: fails closed", () => {
  const w = sandbox({ manifest: `${VERSION} linux-x64 not-a-digest\n` });
  w.engine(w.paths.sibling(), "good");
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.match(result.stderr, /malformed/);
});

test("duplicate manifest entries for one platform: fails closed", () => {
  const w = sandbox();
  const digest = w.engine(w.paths.sibling(), "good");
  writeFileSync(w.manifestPath, `${VERSION} linux-x64 ${digest}\n${VERSION} linux-x64 ${sha256("other")}\n`);
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
});

test("missing VERSION file: fails closed", () => {
  const w = sandbox({ version: null });
  w.trust(w.engine(w.paths.sibling(), "good"));
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
});

test("no SHA-256 tool available: fails closed", () => {
  const w = sandbox({ hashers: [] });
  w.trust(w.engine(w.paths.sibling(), "good"));
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.match(result.stderr, /no SHA-256 tool/);
});

test("unsupported operating system: fails closed", () => {
  const w = sandbox({ unameS: "SunOS" });
  w.trust(w.engine(w.paths.sibling(), "good"));
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.match(result.stderr, /unsupported platform/);
});

test("unsupported CPU architecture: fails closed", () => {
  const w = sandbox({ unameM: "riscv64" });
  w.trust(w.engine(w.paths.sibling(), "good"));
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
});

test("simulated macOS arm64 with shasum only: verifies against the darwin-arm64 entry", { skip: which("shasum") ? false : "shasum not installed" }, () => {
  const w = sandbox({ unameS: "Darwin", unameM: "arm64", hashers: ["shasum"] });
  w.trust(w.engine(w.paths.sibling("darwin-arm64"), "good-mac"), "darwin-arm64");
  const result = w.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "RAN good-mac context");
});

test("download: a file matching the committed digest is cached and run", () => {
  const w = sandbox();
  const source = join(w.base, "release-asset");
  w.trust(w.engine(source, "downloaded"));
  const result = w.run(["context"], { FAKE_CURL_SOURCE: source });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "RAN downloaded context");
  assert.ok(existsSync(w.paths.cache));
  assert.equal(
    result.requested.trim(),
    "https://github.com/pbakaus/impeccable/releases/download/engine-v0.1.14/impeccable-linux-x64",
  );
});

test("download: a replaced release asset is deleted and never executed; no sidecar can vouch for it", () => {
  const w = sandbox();
  const source = join(w.base, "release-asset");
  w.engine(source, "evil-download");
  w.trust(sha256("the reviewed binary, which this is not"));
  const result = w.run(["context"], { FAKE_CURL_SOURCE: source });
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.ok(!existsSync(w.paths.cache), "nothing may be cached");
  assert.doesNotMatch(result.requested, /\.sha256/, "the launcher must not consult a .sha256 sidecar");
  assert.match(result.stderr, /deleted and not run/);
});

test("download: IMPECCABLE_DOWNLOAD_BASE cannot substitute a different binary", () => {
  const w = sandbox();
  const source = join(w.base, "mirror-asset");
  w.engine(source, "evil-mirror");
  w.trust(sha256("the reviewed binary, which this is not"));
  const result = w.run(["context"], {
    FAKE_CURL_SOURCE: source,
    IMPECCABLE_DOWNLOAD_BASE: "https://mirror.invalid/dl",
  });
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.match(result.requested, /^https:\/\/mirror\.invalid\/dl\/engine-v0\.1\.14\/impeccable-linux-x64$/m);
});

test("download: an unreachable release fails with setup help and runs nothing", () => {
  const w = sandbox();
  w.trust(sha256("anything"));
  const result = w.run();
  assert.equal(result.status, 127);
  assert.equal(result.executed, "");
  assert.match(result.stderr, /could not download engine 0\.1\.14/);
});

test("no download is attempted from inside another launcher's probe", () => {
  const w = sandbox();
  w.trust(sha256("anything"));
  const result = w.run(["engine-probe"], { IMPECCABLE_LAUNCHER_PROBE: "1" });
  assert.equal(result.status, 127);
  assert.equal(result.requested, "");
});

test("committed manifest pins the reviewed linux-x64 digest for the vendored engine version", () => {
  assert.equal(committedVersion, VERSION);
  const entries = committedManifest
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));
  for (const [version, platform, digest] of entries) {
    assert.equal(version, committedVersion, `stale manifest entry for ${platform}`);
    assert.match(digest, /^[0-9a-f]{64}$/);
  }
  const platforms = entries.map(([, platform]) => platform);
  assert.equal(new Set(platforms).size, platforms.length, "one entry per platform");
  assert.ok(
    entries.some(
      ([, platform, digest]) =>
        platform === "linux-x64" &&
        digest === "3d31ec1a664ac35c815ea1d7c10abad1155ce364d0f461157eb837a34368efb6",
    ),
  );
  assert.ok(!platforms.some((platform) => platform.startsWith("windows")), "Windows stays fail-closed");
});

test("committed Windows launcher is the fail-closed stub", () => {
  const cmd = readFileSync(join(scriptsDir, "impeccable.cmd"), "utf8");
  const code = cmd
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^rem\b/i.test(line.trim()));
  assert.deepEqual(code.slice(0, 2), ["@echo off", "setlocal"]);
  assert.equal(code.at(-1), "exit /b 127");
  for (const line of code.slice(2, -1)) assert.match(line, /^echo .* 1>&2$/);
});

// Governance guards. `npx impeccable update` rewrites the skill directory and
// reinstalls the shipped agents, which would silently drop all of these.
const repoRoot = join(here, "..");

test("SKILL.md opens with the Dibayar rules before any upstream instruction", () => {
  const skill = readFileSync(join(scriptsDir, "..", "SKILL.md"), "utf8");
  const body = skill.split("\n---\n").slice(1).join("\n---\n").trimStart();
  assert.ok(body.startsWith("> **Dibayar project rules."), "project rules must be the first thing after the frontmatter");
  const rules = body.slice(0, body.indexOf("\n\n"));
  assert.match(rules, /never create, edit, regenerate, replace or delete them/);
  assert.match(rules, /Do not run `init`, `teach` or `document`/);
  assert.match(rules, /Do not spawn a documenter subagent/);
  assert.match(rules, /Hooks stay off/);
});

test("the documenter subagent is not installed", () => {
  assert.ok(!existsSync(join(repoRoot, ".claude", "agents", "impeccable-documenter.md")));
});

test("CLAUDE.md points at the Impeccable rules", () => {
  const claude = readFileSync(join(repoRoot, "CLAUDE.md"), "utf8");
  assert.match(claude, /## Impeccable design skill/);
  assert.match(claude, /may only \*\*read\*\* `PRODUCT\.md` and `DESIGN\.md`/);
  assert.match(claude, /docs\/tooling\/IMPECCABLE\.md/);
});

test("the upstream license and notice ship with the vendored skill", () => {
  const license = readFileSync(join(scriptsDir, "..", "LICENSE"), "utf8");
  assert.match(license, /Apache License\s+Version 2\.0, January 2004/);
  assert.match(license, /Copyright 2025 Paul Bakaus/);
  assert.ok(existsSync(join(scriptsDir, "..", "NOTICE.md")));
});
