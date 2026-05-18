import { expect, test } from "@playwright/test";
import { getExpectedAssistantReply } from "./helpers";

test.describe.configure({ timeout: 45_000 });

test("mobile chat viewport stays bounded after sending a message", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await expect(
		page.getByText(
			"New conversations are saved for this session until you clear them.",
		),
	).toBeVisible();

	const prompt = "Keep the phone chat panel stable after this message is sent.";
	const threadRoot = page.locator(".aui-thread-root");

	await page.getByLabel("Message input").fill(prompt);
	await page.getByRole("button", { name: "Send message" }).click();

	await expect(page.getByText(prompt, { exact: true })).toBeVisible();
	await expect(
		page.getByText(getExpectedAssistantReply(prompt), { exact: true }),
	).toBeVisible();

	const heights = [];
	for (let index = 0; index < 4; index += 1) {
		await page.waitForTimeout(200);
		heights.push(
			await threadRoot.evaluate((root) => root.getBoundingClientRect().height),
		);
	}

	const metrics = await threadRoot.evaluate((root) => {
		const viewport = root.querySelector<HTMLElement>(".aui-thread-viewport");

		return {
			maxRootHeight: Math.max(
				...Array.from(
					document.querySelectorAll<HTMLElement>(".aui-thread-root"),
					(element) => element.getBoundingClientRect().height,
				),
			),
			rootHeight: root.getBoundingClientRect().height,
			viewportHeight: viewport?.clientHeight ?? 0,
			windowHeight: window.innerHeight,
		};
	});

	expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(4);
	expect(metrics.rootHeight).toBeLessThanOrEqual(metrics.windowHeight);
	expect(metrics.maxRootHeight).toBeLessThanOrEqual(metrics.windowHeight);
	expect(metrics.viewportHeight).toBeGreaterThan(0);
	expect(metrics.viewportHeight).toBeLessThan(metrics.rootHeight);
});
