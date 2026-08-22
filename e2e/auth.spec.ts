import { expect, test } from "@playwright/test";

test("student signs in with a class code and their name", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("e.g. K4TR9M").fill("k4tr9m"); // lowercase should still work
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: /Period 2/ })).toBeVisible();

  await page.getByPlaceholder("Start typing your name…").fill("Okaf");
  await page.getByRole("button", { name: "Amara Okafor" }).click();
  await page.getByRole("button", { name: "That's me" }).click();

  await expect(page).toHaveURL(/\/student/);
});

test("a bad class code is rejected", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("e.g. K4TR9M").fill("ZZZZZZ");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("form-error")).toContainText("doesn't match a class");
});

test("teacher signs in with the password", async ({ page }) => {
  await page.goto("/teacher/signin");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("form-error")).toContainText("Wrong password");

  await page.getByLabel("Password").fill("devpassword");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/teacher/);
});
