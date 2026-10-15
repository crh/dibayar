import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { createDeal, listDeals, type DealDb } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import {
  deviceFamily,
  logDealCreateFailure,
  newFailureRef,
  safeErrorName,
  summarizeIssues,
  type DealCreateFailureCode,
  type DealCreateIssue,
} from "@/lib/deal-create-diagnostics";
import { isSameOriginRequest } from "@/lib/request-origin";

const db = prisma as unknown as DealDb;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const deals = await listDeals(db, session.user.id);
    return NextResponse.json({ deals });
  } catch {
    return NextResponse.json({ error: "Deal belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const device = deviceFamily(request.headers.get("user-agent"));
  function failure(
    status: number,
    code: DealCreateFailureCode,
    body: Record<string, unknown>,
    detail: { issues?: DealCreateIssue[]; errorName?: string } = {},
  ) {
    const ref = newFailureRef();
    logDealCreateFailure({ ref, status, code, device, ...detail });
    return NextResponse.json({ ...body, code, ref }, { status });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return failure(401, "UNAUTHENTICATED", { error: "Kamu harus masuk terlebih dahulu." });
    }
    if (!isSameOriginRequest(request)) {
      return failure(403, "ORIGIN_REJECTED", { error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." });
    }

    const deal = await createDeal(db, session.user.id, await request.json());
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return failure(
        400,
        "INVALID_INPUT",
        { error: "Periksa kembali data deal kamu.", fields: error.flatten().fieldErrors },
        { issues: summarizeIssues(error) },
      );
    }
    if (error instanceof SyntaxError) {
      return failure(400, "INVALID_JSON", { error: "Periksa kembali data deal kamu." });
    }

    return failure(500, "SERVER_ERROR", { error: "Deal belum bisa disimpan. Coba lagi." }, { errorName: safeErrorName(error) });
  }
}
