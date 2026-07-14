import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardClient from "./dashboard-client";

describe("DashboardClient", () => {
  it("shows the six pipeline stages and a fast deal capture form", () => {
    render(<DashboardClient initialDeals={[]} userName="Chris" />);

    for (const stage of ["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"]) {
      expect(screen.getByRole("heading", { name: stage })).toBeDefined();
    }
    expect(screen.getByRole("textbox", { name: "Nama brand" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Kontak WhatsApp" })).toBeDefined();
    expect(screen.getByRole("spinbutton", { name: "Fee (Rp)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Simpan deal" })).toBeDefined();
  });

  it("renders an existing deal in its pipeline stage", () => {
    render(
      <DashboardClient
        userName="Chris"
        initialDeals={[
          {
            id: "deal-1",
            userId: "user-1",
            brand: "Kopi Nusantara",
            contactWa: "6281212345678",
            scope: "3 video TikTok",
            feeIdr: 1500000,
            deadline: null,
            paymentTerms: null,
            status: "NEGO",
            createdAt: new Date("2026-07-13T00:00:00.000Z"),
            updatedAt: new Date("2026-07-13T00:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(screen.getByText("Kopi Nusantara")).toBeDefined();
    expect(screen.getByText("Rp1.500.000")).toBeDefined();
    const negoStage = screen.getByRole("region", { name: "Nego" });
    expect(negoStage.textContent).toContain("Kopi Nusantara");
  });
});
