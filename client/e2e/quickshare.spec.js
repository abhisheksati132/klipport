import { test, expect } from "@playwright/test";

// The product promise: data enters on one device and appears on the other.
// Quick Share is account-free, so this exercises the real socket flow end to end
// (client A -> Express/Socket.io -> client B) with zero mocks.

test("quick share pairs two browser contexts and syncs text both ways", async ({ browser }) => {
  const deviceA = await browser.newContext();
  const deviceB = await browser.newContext();
  const pageA = await deviceA.newPage();
  const pageB = await deviceB.newPage();

  // Device A creates a session
  await pageA.goto("/quick-share");
  await expect(pageA.getByText("Live Server")).toBeVisible({ timeout: 15000 });
  await pageA.getByRole("button", { name: "Create New Session" }).click();

  const codeLocator = pageA.locator(".text-4xl.font-extrabold");
  await expect(codeLocator).toBeVisible({ timeout: 10000 });
  const code = (await codeLocator.textContent()).trim();
  expect(code).toMatch(/^\d{6}$/);

  // Device B joins via the pairing URL (same entry point as the QR code)
  await pageB.goto(`/quick-share?code=${code}`);
  await expect(pageB.getByText("Connected with peer")).toBeVisible({ timeout: 15000 });
  await expect(pageA.getByText("Connected with peer")).toBeVisible({ timeout: 15000 });

  // A -> B
  const uniqueForward = `klipport-e2e-forward-${Date.now()}`;
  await pageB.locator('input[placeholder="Type or paste text to sync..."]').fill(uniqueForward);
  await pageB.getByTitle("Send Text").click();
  await expect(pageA.getByText(uniqueForward)).toBeVisible({ timeout: 10000 });

  // B -> A
  const uniqueReply = `klipport-e2e-reply-${Date.now()}`;
  await pageA.locator('input[placeholder="Type or paste text to sync..."]').fill(uniqueReply);
  await pageA.getByTitle("Send Text").click();
  await expect(pageB.getByText(uniqueReply)).toBeVisible({ timeout: 10000 });

  await deviceA.close();
  await deviceB.close();
});

test("quick share rejects an invalid session code", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/quick-share");
  await expect(page.getByText("Live Server")).toBeVisible({ timeout: 15000 });

  await page.locator('input[placeholder="Enter 6-digit session code"]').fill("000000");
  await page.getByRole("button", { name: "Join Session" }).click();

  await expect(page.getByText(/invalid or expired/i)).toBeVisible({ timeout: 10000 });

  await context.close();
});
