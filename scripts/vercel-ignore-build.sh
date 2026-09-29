#!/usr/bin/env bash
# Vercel "Ignore Build Step" command (docs/DEVELOPMENT-WORKFLOW.md, "Ordinary
# branches are CI-only"; DEPLOYMENT.md, "Environment mechanics").
#
# ROLE: secondary, fail-safe build suppression. The PRIMARY control is
# `git.deploymentEnabled` in vercel.json, which stops Vercel from creating an
# automatic deployment for a non-allowlisted branch at all. This script runs
# only AFTER a deployment already exists, and live evidence (PR #17,
# 2026-09-27/28) showed the Vercel<->Neon integration provisions a Neon
# preview branch when the deployment is created, before this script cancels
# the build. So this script alone does NOT prevent Neon branch provisioning;
# it only stops the build if a non-allowlisted ref ever reaches it anyway
# (e.g. a manual redeploy, or a future change to vercel.json).
#
# Vercel's semantics here are inverted from normal shell truthiness:
#   exit 0  -> SKIP this build
#   exit 1  -> PROCEED with this build
#
# Allowlist (deploy): main, staging, preview/** (nested names such as
# preview/codex/foo included). KEEP IN SYNC with git.deploymentEnabled in
# vercel.json (scripts/vercel-ignore-build.test.mjs asserts both).
# Everything else (feature/*, fix/*, chore/*, legacy codex/*, hermes/*, etc.)
# is skipped. Prefer this allowlist over a denylist so a brand-new branch
# prefix is CI-only by default instead of accidentally deploying.
#
# VERCEL_GIT_COMMIT_REF is set by Vercel for every Git-triggered build
# (https://vercel.com/docs/environment-variables/system-environment-variables).
# If it is ever missing, fail open (build) rather than silently skipping --
# an unexpected skip of `main`/`staging` is a worse failure mode than an
# extra build for an unrecognized ref.
ref="${VERCEL_GIT_COMMIT_REF:-}"

if [ -z "$ref" ]; then
  echo "vercel-ignore-build: VERCEL_GIT_COMMIT_REF is unset; building (fail open)"
  exit 1
fi

case "$ref" in
  main|staging)
    echo "vercel-ignore-build: '$ref' is allowlisted; building"
    exit 1
    ;;
  # Bash `case` globs let `*` match `/`, so this also covers nested names
  # like preview/codex/foo (unlike minimatch, where `*` stops at `/`).
  preview/*)
    echo "vercel-ignore-build: '$ref' matches preview/**; building"
    exit 1
    ;;
  *)
    echo "vercel-ignore-build: '$ref' is not allowlisted (main, staging, preview/** only); skipping"
    exit 0
    ;;
esac
