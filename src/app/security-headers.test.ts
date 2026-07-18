import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function getHeaderGroups() {
  return nextConfig.headers!();
}

async function getGlobalGroup() {
  const headerGroups = await getHeaderGroups();
  const group = headerGroups.find((group) => group.source === "/:path*");
  if (!group) throw new Error("Global security header group not configured");
  return group;
}

async function getCsp() {
  const group = await getGlobalGroup();
  const csp = group.headers.find(
    (header) => header.key === "Content-Security-Policy",
  );
  if (!csp) throw new Error("Content-Security-Policy header not configured");
  return csp.value;
}

function headerValue(headers: { key: string; value: string }[], key: string) {
  return headers.find((header) => header.key === key)?.value;
}

describe("Content-Security-Policy", () => {
  it("allows Google's OAuth host as a sign-in form-action target, in addition to self", async () => {
    const csp = await getCsp();
    const formAction = csp.split("; ").find((directive) => directive.startsWith("form-action"));

    expect(formAction).toBe("form-action 'self' https://accounts.google.com");
  });

  it("allows the Auth.js provider logo host for img-src, in addition to self and data:", async () => {
    const csp = await getCsp();
    const imgSrc = csp.split("; ").find((directive) => directive.startsWith("img-src"));

    expect(imgSrc).toBe("img-src 'self' data: https://authjs.dev");
  });

  it("does not add a wildcard or extra google host beyond the required OAuth host", async () => {
    const csp = await getCsp();

    expect(csp).not.toContain("*.google.com");
    expect(csp.match(/google/g)).toEqual(["google"]);
  });

  it("keeps restrictive defaults for script, frame-ancestors, and base-uri", async () => {
    const csp = await getCsp();

    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/base-uri 'self'/);
    expect(csp).toMatch(/default-src 'self'/);
  });
});

describe("Public share link headers (/i/:path*)", () => {
  it("defines a route-specific header group for the token-bearing HTML route", async () => {
    const headerGroups = await getHeaderGroups();
    const group = headerGroups.find((group) => group.source === "/i/:path*");

    expect(group).toBeDefined();
  });

  it("sets no-referrer, noindex, and private/no-store on the /i/:path* route, stricter than the global defaults", async () => {
    const headerGroups = await getHeaderGroups();
    const globalGroup = headerGroups.find((group) => group.source === "/:path*")!;
    const shareGroup = headerGroups.find((group) => group.source === "/i/:path*")!;

    expect(headerValue(globalGroup.headers, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerValue(shareGroup.headers, "Referrer-Policy")).toBe("no-referrer");
    expect(headerValue(shareGroup.headers, "X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(headerValue(shareGroup.headers, "Cache-Control")).toBe("private, no-store");
  });

  it("orders the /i/:path* group after the global group so its overrides win, per Next.js header merge order", async () => {
    const headerGroups = await getHeaderGroups();
    const globalIndex = headerGroups.findIndex((group) => group.source === "/:path*");
    const shareIndex = headerGroups.findIndex((group) => group.source === "/i/:path*");

    expect(globalIndex).toBeGreaterThanOrEqual(0);
    expect(shareIndex).toBeGreaterThan(globalIndex);
  });

  it("does not redeclare or weaken CSP, frame, or content-type headers on the route-specific group", async () => {
    const headerGroups = await getHeaderGroups();
    const shareGroup = headerGroups.find((group) => group.source === "/i/:path*")!;

    expect(headerValue(shareGroup.headers, "Content-Security-Policy")).toBeUndefined();
    expect(headerValue(shareGroup.headers, "X-Frame-Options")).toBeUndefined();
    expect(headerValue(shareGroup.headers, "X-Content-Type-Options")).toBeUndefined();
  });

  it("matches the same strict values the public JSON/PDF API routes already send", async () => {
    const headerGroups = await getHeaderGroups();
    const shareGroup = headerGroups.find((group) => group.source === "/i/:path*")!;

    // Mirrors RECIPIENT_SAFE_HEADERS in src/app/api/public/invoices/[token]/route.ts
    expect(headerValue(shareGroup.headers, "Cache-Control")).toBe("private, no-store");
    expect(headerValue(shareGroup.headers, "X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(headerValue(shareGroup.headers, "Referrer-Policy")).toBe("no-referrer");
  });
});
