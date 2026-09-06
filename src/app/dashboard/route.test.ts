import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /dashboard", () => {
  it("redirects to / with an HTTP 302", () => {
    const request = new Request("http://localhost/dashboard");
    const response = GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("drops query parameters on redirect", () => {
    const request = new Request("http://localhost/dashboard?tab=invoices&x=1");
    const response = GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
