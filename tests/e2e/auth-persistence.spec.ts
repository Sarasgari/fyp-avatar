import { expect, test } from "@playwright/test";
import {
	createUniqueCredentials,
	getExpectedAssistantReply,
	loginAccount,
	openHomePage,
	registerAccount,
	sendMessage,
} from "./helpers";

test.describe.configure({ timeout: 45_000 });

test("guest conversation migrates into an account and sign-out returns to guest scope", async ({
	page,
}) => {
	const prompt = "Please keep this conversation when I register.";
	const reply = getExpectedAssistantReply(prompt);
	const credentials = createUniqueCredentials("migration");

	await openHomePage(page);
	await sendMessage({
		page,
		prompt,
	});

	await expect(
		page.getByText("Conversation is saved for this session."),
	).toBeVisible();

	await registerAccount({
		page,
		email: credentials.email,
		password: credentials.password,
	});

	await page.reload();

	await expect(page.getByText(credentials.email)).toBeVisible();
	await expect(
		page.getByText("Conversation is saved to your account."),
	).toBeVisible();
	await expect(page.getByText(reply, { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Sign out" }).click();

	await expect(page.getByText("Guest session")).toBeVisible();
	await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
	await expect(
		page.getByText(
			"New conversations are saved for this session until you clear them.",
		),
	).toBeVisible();
	await expect(page.getByRole("heading", { name: "Hi there" })).toBeVisible();
	await expect(page.getByText(reply, { exact: true })).toHaveCount(0);
});

test("signed-in users can restore saved history in a new browser context and clear it after TTS failure", async ({
	browser,
}) => {
	const prompt = "Save this to my account even if speech fails.";
	const reply = getExpectedAssistantReply(prompt);
	const credentials = createUniqueCredentials("restore");
	const firstContext = await browser.newContext();
	const firstPage = await firstContext.newPage();

	await openHomePage(firstPage);
	await registerAccount({
		page: firstPage,
		email: credentials.email,
		password: credentials.password,
	});
	await sendMessage({
		page: firstPage,
		prompt,
	});
	await expect(
		firstPage.getByText("Conversation is saved to your account."),
	).toBeVisible();

	await firstContext.close();

	const secondContext = await browser.newContext();
	const secondPage = await secondContext.newPage();

	await openHomePage(secondPage);
	await loginAccount({
		page: secondPage,
		email: credentials.email,
		password: credentials.password,
	});

	await secondPage.reload();

	await expect(
		secondPage.getByText("Conversation is saved to your account."),
	).toBeVisible();
	await expect(secondPage.getByText(reply, { exact: true })).toBeVisible();

	const threadDeleteResponse = secondPage.waitForResponse((response) => {
		return (
			response.url().includes("/api/thread") &&
			response.request().method() === "DELETE" &&
			response.status() === 204
		);
	});
	secondPage.once("dialog", async (dialog) => {
		await dialog.accept();
	});
	await secondPage.getByRole("button", { name: "Clear conversation" }).click();
	await threadDeleteResponse;

	await expect(
		secondPage.getByRole("heading", { name: "Hi there" }),
	).toBeVisible();
	await expect(
		secondPage.getByText(
			"New conversations are saved to your account until you clear them.",
		),
	).toBeVisible();
	await expect(secondPage.getByText(reply, { exact: true })).toHaveCount(0);

	await secondPage.reload();

	await expect(secondPage.getByText(credentials.email)).toBeVisible();
	await expect(
		secondPage.getByRole("heading", { name: "Hi there" }),
	).toBeVisible();
	await expect(secondPage.getByText(reply, { exact: true })).toHaveCount(0);

	await secondContext.close();
});
