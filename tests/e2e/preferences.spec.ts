import { expect, test } from "@playwright/test";
import { openHomePage } from "./helpers";

test.describe.configure({ timeout: 45_000 });

test("avatar can be shown again after reduced motion is enabled", async ({
	page,
}) => {
	await openHomePage(page);
	await expect(page.locator("canvas")).toHaveCount(1);

	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByLabel("Reduced motion").check();
	await page.getByRole("button", { name: "Done" }).click();

	await expect(page.locator("canvas")).toHaveCount(1);
	await expect(page.getByText("Live avatar", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByLabel("Avatar visibility").uncheck();
	await page.getByRole("button", { name: "Done" }).click();

	await expect(
		page.getByRole("heading", { name: "Avatar hidden" }),
	).toBeVisible();
	await expect(page.locator("canvas")).toHaveCount(0);

	await page.getByRole("button", { name: "Settings" }).click();
	await page.getByLabel("Avatar visibility").check();
	await page.getByRole("button", { name: "Done" }).click();

	await expect(page.locator("canvas")).toHaveCount(1);
	await expect(page.getByText("Live avatar", { exact: true })).toBeVisible();
});
