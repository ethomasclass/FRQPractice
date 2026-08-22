import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

// This suite needs a finished review round. flow.spec leaves one review partly
// judged by hand; the seeder fills in the rest without disturbing it.
test.beforeAll(() => {
  execFileSync("npx", ["tsx", "lib/db/seed-reviews.ts"], { stdio: "inherit" });
});

/**
 * Grading with no API key: peer majority alone should settle every point, and
 * calibration should stay blank rather than inventing agreement out of nothing.
 */
test("teacher settles peer scores and exports the gradebook", async ({ page }) => {
  await page.goto("/teacher/signin");
  await page.getByLabel("Password").fill("devpassword");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("link", { name: /Grade contested points/ }).click();
  await expect(page.getByRole("heading", { name: /Supranational/ })).toBeVisible();

  // Scoring is unavailable without a key, and must say so rather than fail loudly.
  await expect(page.getByRole("button", { name: "Score responses" })).toBeDisabled();

  await page.getByRole("button", { name: "Recalculate" }).click();
  await expect(page.getByText("Reviewer calibration")).toBeVisible();

  // Every submitted response should now carry a settled score.
  const scores = page.locator("main").getByText(/^\d+\/7$/);
  await expect(scores).toHaveCount(8);

  // With no independent read, nobody can be graded on their reviewing yet.
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(8);
  await expect(rows.first().getByText("—")).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export CSV" }).click(),
  ]);
  expect(download[0].suggestedFilename()).toContain(".csv");
});
