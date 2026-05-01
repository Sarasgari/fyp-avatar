import { expect, type Page } from "@playwright/test";

const DEFAULT_PASSWORD = "password-123";

export const createUniqueCredentials = (prefix: string) => {
	const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 100_000)}`;

	return {
		email: `${prefix}-${uniqueSuffix}@example.com`,
		password: DEFAULT_PASSWORD,
	};
};

export const getExpectedAssistantReply = (prompt: string) =>
	`E2E reply: ${prompt}`;

export const openHomePage = async (page: Page) => {
	await page.goto("/");
	await expect(page.getByText("Guest session")).toBeVisible();
	await expect(
		page.getByText(
			"New conversations are saved for this session until you clear them.",
		),
	).toBeVisible();
};

export const sendMessage = async ({
	page,
	prompt,
}: {
	page: Page;
	prompt: string;
}) => {
	const reply = getExpectedAssistantReply(prompt);
	const threadSaveResponse = page.waitForResponse((response) => {
		return (
			response.url().includes("/api/thread") &&
			response.request().method() === "PUT" &&
			response.ok()
		);
	});

	await page.getByLabel("Message input").fill(prompt);
	await page.getByRole("button", { name: "Send message" }).click();

	await expect(page.getByText(prompt, { exact: true })).toBeVisible();
	await expect(page.getByText(reply, { exact: true })).toBeVisible();
	await threadSaveResponse;
};

export const registerAccount = async ({
	page,
	email,
	password,
}: {
	page: Page;
	email: string;
	password: string;
}) => {
	await page.getByRole("button", { name: "Sign in" }).click();
	const dialog = page.getByRole("dialog");

	await dialog.getByRole("button", { name: "Create account" }).first().click();
	await dialog.getByLabel("Email").fill(email);
	await dialog.getByLabel("Password").fill(password);
	await dialog.getByRole("button", { name: "Create account" }).last().click();

	await expect(page.getByText(email)).toBeVisible();
	await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
};

export const loginAccount = async ({
	page,
	email,
	password,
}: {
	page: Page;
	email: string;
	password: string;
}) => {
	await page.getByRole("button", { name: "Sign in" }).click();
	const dialog = page.getByRole("dialog");

	await dialog.getByLabel("Email").fill(email);
	await dialog.getByLabel("Password").fill(password);
	await dialog.getByRole("button", { name: "Sign in" }).last().click();

	await expect(page.getByText(email)).toBeVisible();
	await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
};
