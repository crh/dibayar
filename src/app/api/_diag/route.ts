// TEMPORARY diagnostic route -- added to trace a P2022 "column does not
// exist" mystery on Preview where a direct psql connection to the same
// host/db sees the column but the deployed app's Prisma client does not.
// Uses the exact same `prisma` singleton as the rest of the app
// (src/lib/prisma.ts) so this reports what the real runtime actually sees.
// No secrets returned -- only schema/connection metadata. Refuses to run
// outside Preview as defense in depth. Removed once root-caused.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "diagnostic route disabled in production" }, { status: 403 });
  }

  try {
    const [session] = await prisma.$queryRaw<
      { current_database: string; current_user: string; current_schema: string; search_path: string }[]
    >`SELECT current_database(), current_user, current_schema(), current_setting('search_path') as search_path`;

    const contactNameColumns = await prisma.$queryRaw<
      { table_schema: string; table_name: string; column_name: string }[]
    >`SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE column_name = 'contactName' ORDER BY table_schema, table_name`;

    const dealColumns = await prisma.$queryRaw<
      { table_schema: string; table_name: string; column_name: string; ordinal_position: number }[]
    >`SELECT table_schema, table_name, column_name, ordinal_position FROM information_schema.columns WHERE table_name = 'Deal' ORDER BY table_schema, ordinal_position`;

    const dealTables = await prisma.$queryRaw<
      { table_schema: string; table_name: string }[]
    >`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'Deal' ORDER BY table_schema`;

    const migrations = await prisma.$queryRaw<
      { migration_name: string; started_at: Date; finished_at: Date | null; rolled_back_at: Date | null }[]
    >`SELECT migration_name, started_at, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 15`;

    // process.env.DATABASE_URL host/db only -- never the credentials.
    let dbUrlHost: string | null = null;
    let dbUrlDb: string | null = null;
    try {
      const u = new URL(process.env.DATABASE_URL ?? "");
      dbUrlHost = u.hostname;
      dbUrlDb = u.pathname.replace("/", "");
    } catch {
      // leave null
    }

    return NextResponse.json({
      envDatabaseUrlHost: dbUrlHost,
      envDatabaseUrlDb: dbUrlDb,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelGitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      session,
      contactNameColumns,
      dealColumns,
      dealTables,
      migrations,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), raw: JSON.stringify(error, Object.getOwnPropertyNames(error as object)) },
      { status: 500 },
    );
  }
}
