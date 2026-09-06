import { describe, expect, it } from "vitest";
import { getRouteTitle } from "./route-title";

describe("getRouteTitle", () => {
  it("maps each top-level route to its translated nav label, in both languages", () => {
    expect(getRouteTitle("/", "id")).toBe("Beranda");
    expect(getRouteTitle("/deal", "id")).toBe("Deal");
    expect(getRouteTitle("/invoice", "id")).toBe("Invoice");
    expect(getRouteTitle("/pengaturan", "id")).toBe("Pengaturan");

    expect(getRouteTitle("/", "en")).toBe("Home");
    expect(getRouteTitle("/deal", "en")).toBe("Deals");
    expect(getRouteTitle("/invoice", "en")).toBe("Invoices");
    expect(getRouteTitle("/pengaturan", "en")).toBe("Settings");
  });

  it("treats a nested detail route as belonging to its parent route", () => {
    expect(getRouteTitle("/deal/abc123", "id")).toBe("Deal");
    expect(getRouteTitle("/invoice/inv-1", "en")).toBe("Invoices");
  });
});
