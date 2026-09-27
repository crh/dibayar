#!/usr/bin/env bash
# Vercel "Ignore Build Step" command (docs/DEVELOPMENT-WORKFLOW.md, "Ordinary
# branches are CI-only"; DEPLOYMENT.md, "Environment mechanics").
#
# Vercel's semantics here are inverted from normal shell truthiness:
#   exit 0  -> SKIP this build
#   exit 1  -> PROCEED with this build
#
# Allowlist (deploy): main, staging, preview/*
# Everything else (feature/*, fix/*, chore/*, legacy codex/*, hermes/*, etc.)
# is skipped, so it never creates a Vercel deployment or a Neon preview
# branch. Prefer this allowlist over a denylist so a brand-new branch prefix
# is CI-only by default instead of accidentally deploying.
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
  preview/*)
    echo "vercel-ignore-build: '$ref' matches preview/*; building"
    exit 1
    ;;
  *)
    echo "vercel-ignore-build: '$ref' is not allowlisted (main, staging, preview/* only); skipping"
    exit 0
    ;;
esac
