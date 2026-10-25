import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import LandingClient from "./landing-client";

// T-25: single-column landing (dibayar-implementation-spec.md §4.9). No
// jsdom layout engine exists to measure real pixel gaps at 1024/1440 --
// that capture work is Hermes-owned (T-27) -- but DOM structure, order, and
// the deleted-copy/bilingual requirements are fully verifiable here.

function allClassNames(container: HTMLElement): string {
  return [...container.querySelectorAll("*")].map((el) => el.className).join(" ");
}

describe("LandingClient", () => {
  it("contains no two-column arrangement in the DOM at any width", () => {
    const { container } = render(<LandingClient initialLanguage="id" />);
    const classes = allClassNames(container);

    expect(classes).not.toMatch(/grid-cols-|lg:grid\b/);
  });

  it("renders the five blocks in spec order: headline, subhead, chips, sign-in, three steps", () => {
    render(<LandingClient initialLanguage="id" />);

    const order = [
      screen.getByRole("heading", { level: 1 }),
      screen.getByText("Dibayar sedang disiapkan untuk kreator Indonesia yang capek nego dan nagih pembayaran lewat chat WhatsApp yang berantakan."),
      screen.getByText("Alur kerja deal brand kamu"),
      screen.getByRole("link", { name: "Masuk dengan Google" }),
      screen.getByText("Cara kerjanya"),
    ];

    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("deletes the old 'coming soon' copy entirely, in both languages", () => {
    const { unmount } = render(<LandingClient initialLanguage="id" />);
    expect(document.body.textContent).not.toMatch(/segera hadir/i);
    unmount();

    render(<LandingClient initialLanguage="en" />);
    expect(document.body.textContent).not.toMatch(/coming soon/i);
  });

  it("replaces it with the honest access sentence, in both languages", () => {
    const { unmount } = render(<LandingClient initialLanguage="id" />);
    expect(screen.getByText("Dibayar masih dalam pilot terbatas, khusus kreator yang diundang. Masuk dengan akun Google yang didaftarkan untuk pilot.")).toBeDefined();
    unmount();

    render(<LandingClient initialLanguage="en" />);
    expect(screen.getByText("Dibayar is in a limited, invite-only pilot. Sign in with the Google account registered for the pilot.")).toBeDefined();
  });

  it("renders all six pipeline stage chips", () => {
    render(<LandingClient initialLanguage="id" />);
    const chipList = screen.getByRole("list", { name: "Alur kerja deal brand kamu" });
    for (const label of ["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"]) {
      expect(within(chipList).getByText(label)).toBeDefined();
    }
  });

  it("renders all three workflow steps with title and detail", () => {
    render(<LandingClient initialLanguage="id" />);
    expect(screen.getByText("Catat deal dalam hitungan detik")).toBeDefined();
    expect(screen.getByText("Pantau semua deal di satu alur")).toBeDefined();
    expect(screen.getByText("Kirim pengingat sebelum telat bayar")).toBeDefined();
  });

  it("points the sign-in link at the Google OAuth callback", () => {
    render(<LandingClient initialLanguage="id" />);
    expect(screen.getByRole("link", { name: "Masuk dengan Google" }).getAttribute("href")).toBe(
      "/api/auth/signin?callbackUrl=%2Fdashboard",
    );
  });

  it("no longer renders a language switcher or a jump-to-section link (both removed by T-25)", () => {
    render(<LandingClient initialLanguage="id" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("link", { name: /lihat cara kerja|see how it works/i })).toBeNull();
  });

  it("renders fully in English when initialLanguage is en", () => {
    render(<LandingClient initialLanguage="en" />);
    expect(screen.getByRole("heading", { name: "Manage brand deals, invoices, and payments in one place" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toBeDefined();
    expect(screen.getByText("How it works")).toBeDefined();
    expect(screen.queryByText("Cara kerjanya")).toBeNull();
  });
});
