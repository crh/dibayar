import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/auth";
import { authRateLimiter } from "@/lib/rate-limit";

function rateLimitResponse(request: NextRequest) {
  if (request.method !== "POST") return null;

  const pathParts = new URL(request.url).pathname.split("/").filter(Boolean);
  const authAction = pathParts[2];
  if (authAction !== "signin") return null;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const key = forwardedFor?.split(",")[0]?.trim() || "unknown-client";
  const result = authRateLimiter.check(key);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Terlalu banyak percobaan masuk. Coba lagi sebentar." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) },
    },
  );
}

export async function GET(request: NextRequest) {
  return rateLimitResponse(request) ?? handlers.GET(request);
}

export async function POST(request: NextRequest) {
  return rateLimitResponse(request) ?? handlers.POST(request);
}
