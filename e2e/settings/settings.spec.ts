import { expect, test } from "@playwright/test";

test.describe("issuer/bank settings", { tag: "@critical" }, () => {
  test("update issuer and bank details, happy path", async ({ page }) => {
    await page.goto("/pengaturan");
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();

    const uniqueName = `E2E Updated Owner ${Date.now()}`;
    await page.getByLabel("Nama / nama usaha").fill(uniqueName);
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();

    await expect(page.getByText("Tersimpan")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Nama / nama usaha")).toHaveValue(uniqueName);
  });

  test("invalid issuer email is rejected with a field-level error, nothing saved", async ({ page }) => {
    await page.goto("/pengaturan");
    const emailField = page.getByLabel("Email");
    await emailField.fill("not-an-email");
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();

    await expect(page.getByText("Email tidak valid.")).toBeVisible();
    await expect(page.getByText("Tersimpan")).toHaveCount(0);
  });
});
