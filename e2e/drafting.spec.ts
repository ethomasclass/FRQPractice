import { expect, test } from "@playwright/test";

/**
 * The guardrail that matters: a drafted rubric must reach the editor and stop
 * there. Without an API key the button is disabled rather than failing.
 */
test("exemplars can be stored and drafting is gated on a key", async ({ page }) => {
  await page.goto("/teacher/signin");
  await page.getByLabel("Password").fill("devpassword");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByRole("link", { name: "Exemplars" }).click();
  await expect(page.getByRole("heading", { name: "Exemplars" })).toBeVisible();

  // Too-short pastes are rejected — a truncated guideline teaches the wrong style.
  await page.getByLabel("Name").fill("2025 Set 1 Q1");
  await page.getByLabel("Pasted text").fill("too short");
  await page.getByRole("button", { name: "Add exemplar" }).click();
  await expect(page.getByTestId("form-error")).toContainText("too short to be useful");

  await page.getByLabel("Pasted text").fill(
    "Question 1: No Stimulus. 7 points. A. Define the concept of an independent state. ".repeat(6),
  );
  await page.getByRole("button", { name: "Add exemplar" }).click();
  await expect(page.getByRole("heading", { name: "2025 Set 1 Q1" })).toBeVisible();

  // The draft panel appears on a draft assignment, disabled without a key.
  await page.getByRole("link", { name: "Assignments" }).click();
  await page.locator("li", { hasText: "Untitled FRQ" }).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Draft this with AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Draft with AI" })).toBeDisabled();
});
