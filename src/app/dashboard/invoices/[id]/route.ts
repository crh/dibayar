import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

// Compatibility redirect: the real invoice detail page moved to /invoice/:id
// in T-19 (see docs/ux-implementation/SPEC_RECONCILIATION.md, "preserve
// /dashboard/invoices/[id] until T-19").
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return NextResponse.redirect(new URL(`/invoice/${id}`, request.url), 302);
}
