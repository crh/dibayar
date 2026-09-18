#!/usr/bin/env bash
set -e

# On Preview, the Neon/Vercel integration writes per-branch migration
# connection strings under DATABASE_URL_POSTGRES_URL_NON_POOLING. Falling
# back to the static DATABASE_URL secret when it's missing recreates the
# incident this exists to prevent (a deleted Neon branch kept being read),
# so Preview must fail the build instead of falling back.
if [ "$VERCEL_ENV" = "preview" ]; then
  if [ -z "$DATABASE_URL_POSTGRES_URL_NON_POOLING" ]; then
    echo "ERROR: DATABASE_URL_POSTGRES_URL_NON_POOLING is required for Vercel Preview migrations" >&2
    exit 1
  fi
  export DATABASE_URL="$DATABASE_URL_POSTGRES_URL_NON_POOLING"
fi

if [ -n "$DATABASE_URL" ]; then
  npx prisma migrate deploy
fi

next build
