import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PengaturanPage from "./page";

describe("/pengaturan placeholder", () => {
  it("renders an accessible heading with no AppShell", () => {
    render(<PengaturanPage />);

    expect(screen.getByRole("heading", { name: "Pengaturan" })).toBeDefined();
  });
});
