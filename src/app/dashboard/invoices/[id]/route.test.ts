import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /dashboard/invoices/:id", () => {
  it("redirects to /invoice/:id with an HTTP 302", async () => {
    const request = new Request("http://localhost/dashboard/invoices/invoice-1");
    const response = await GET(request, { params: Promise.resolve({ id: "invoice-1" }) });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/invoice/invoice-1");
  });

  it("drops query parameters on redirect", async () => {
    const request = new Request("http://localhost/dashboard/invoices/invoice-1?tab=share");
    const response = await GET(request, { params: Promise.resolve({ id: "invoice-1" }) });

    expect(response.headers.get("location")).toBe("http://localhost/invoice/invoice-1");
  });
});
