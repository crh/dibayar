import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function getCsp() {
  const headerGroups = await nextConfig.headers!();
  const csp = headerGroups[0].headers.find(
    (header) => header.key === "Content-Security-Policy",
  );
  if (!csp) throw new Error("Content-Security-Policy header not configured");
  return csp.value;
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
