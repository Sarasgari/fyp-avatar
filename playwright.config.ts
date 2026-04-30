import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PLAYWRIGHT_STATE_DIR = ".playwright-state";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI
		? [["dot"], ["html", { open: "never" }]]
		: [["list"]],
	expect: {
		timeout: 10_000,
	},
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		launchOptions: {
			args: ["--enable-webgl", "--use-angle=swiftshader"],
		},
	},
	projects: [
		{
			name: "chromium",
			use: {
				browserName: "chromium",
			},
		},
	],
	webServer: {
		command: `node -e "require('fs').rmSync('${PLAYWRIGHT_STATE_DIR}', { recursive: true, force: true })" && npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			NEXT_TELEMETRY_DISABLED: "1",
			OPENAI_API_KEY: "test-key",
			SESSION_SIGNING_SECRET: "playwright-session-secret",
			AUTH_SIGNING_SECRET: "playwright-auth-secret",
			ALLOWED_ORIGINS: BASE_URL,
			E2E_CHAT_MOCK: "1",
			E2E_TTS_MODE: "fail",
			THREAD_STORE_FILE_PATH: `${PLAYWRIGHT_STATE_DIR}/thread-store.json`,
			USER_STORE_FILE_PATH: `${PLAYWRIGHT_STATE_DIR}/user-store.json`,
		},
	},
});
