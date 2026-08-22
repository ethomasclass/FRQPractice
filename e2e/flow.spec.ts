import { expect, test } from "@playwright/test";

/** Teacher hands out reviews, then a student completes one end to end. */
test("teacher assigns reviews and a student reviews a peer", async ({ page }) => {
  await page.goto("/teacher/signin");
  await page.getByLabel("Password").fill("devpassword");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  await expect(page.getByText("8 of 20 submitted")).toBeVisible();

  await page.getByRole("button", { name: /Close writing & assign reviews/ }).click();
  await expect(page.getByText("Peer review")).toBeVisible();

  // Absent students must not block anyone.
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page.getByText(/Hasn't submitted \(12\)/)).toBeVisible();
  await expect(page.getByText("0 of 32")).toBeVisible(); // 8 responses x 4 reviewers

  // Now review as a student who submitted.
  await page.context().clearCookies();
  await page.goto("/join/K4TR9M");
  await page.getByPlaceholder("Start typing your name…").fill("Amara");
  await page.getByRole("button", { name: "Amara Okafor" }).click();
  await page.getByRole("button", { name: "That's me" }).click();

  await expect(page.getByText(/0 of 4 reviews finished/)).toBeVisible();
  await page.getByRole("link", { name: "Start reviewing" }).click();

  await expect(page.getByText(/Response \d+ · Anonymous/)).toBeVisible();
  await expect(page.getByText("Part 1 of 7")).toBeVisible();

  // Can't advance without judging.
  await expect(page.getByRole("button", { name: /^Next: part/ })).toBeDisabled();

  // "Earned" alone is not enough — evidence is required.
  await page.getByRole("button", { name: "Earned", exact: true }).click();
  await expect(page.getByText(/can't give the point without pointing at it/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Next: part/ })).toBeDisabled();

  // "Not earned" needs a named reason instead.
  await page.getByRole("button", { name: "Not earned" }).click();
  await expect(page.getByRole("button", { name: /^Next: part/ })).toBeDisabled();
  await page.getByRole("radio", { name: /Described, didn't explain/ }).check();
  await expect(page.getByRole("button", { name: /^Next: part/ })).toBeEnabled();

  await page.getByRole("button", { name: /^Next: part B/ }).click();
  await expect(page.getByText("Part 2 of 7")).toBeVisible();
});
