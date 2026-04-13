import { expect, test } from "@playwright/test";

test.describe("maritime sanctions desk — smoke", () => {
  test("landing page renders the masthead and primary CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Maritime Sanctions Desk/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/sanctions/i);
    await expect(page.getByRole("link", { name: /start a check/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /review prior runs/i })).toBeVisible();
  });

  test("navigates from landing to the new-check intake form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /start a check/i }).first().click();
    await expect(page).toHaveURL(/\/checks\/new/);
    await expect(page.locator("form")).toBeVisible();
  });

  test("history page loads", async ({ page }) => {
    const response = await page.goto("/history");
    expect(response?.ok()).toBeTruthy();
  });

  test("header exposes Instructions, Build Notes, History, and Start Check links", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: /instructions/i })).toHaveAttribute("href", "/instructions");
    await expect(header.getByRole("link", { name: /build notes/i })).toHaveAttribute("href", "/build-notes");
    await expect(header.getByRole("link", { name: /history/i })).toHaveAttribute("href", "/history");
    await expect(header.getByRole("link", { name: /start check/i })).toHaveAttribute("href", "/checks/new");
  });

  test("header Start Check button navigates to the intake form", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: /start check/i }).click();
    await expect(page).toHaveURL(/\/checks\/new/);
    await expect(page.locator("form")).toBeVisible();
  });

  test("instructions page links to the new-check flow", async ({ page }) => {
    await page.goto("/instructions");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: /start a new check/i }).click();
    await expect(page).toHaveURL(/\/checks\/new/);
  });

  test("build notes page renders", async ({ page }) => {
    const response = await page.goto("/build-notes");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("unknown check ids produce a 404 from the API", async ({ request }) => {
    const response = await request.get("/api/checks/does-not-exist");
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test("GET /api/checks returns a summary payload", async ({ request }) => {
    const response = await request.get("/api/checks");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
