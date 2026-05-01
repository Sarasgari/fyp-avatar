import assert from "node:assert/strict";
import { validateProductionServerConfig } from "../../lib/server/production-config";

const ORIGINAL_ENV = {
	ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
	NODE_ENV: process.env.NODE_ENV,
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	SESSION_SIGNING_SECRET: process.env.SESSION_SIGNING_SECRET,
};
const mutableEnv = process.env as Record<string, string | undefined>;

const setNodeEnv = (value: string | undefined) => {
	if (value === undefined) {
		delete mutableEnv.NODE_ENV;
		return;
	}

	mutableEnv.NODE_ENV = value;
};

const restoreEnvironment = () => {
	process.env.ALLOWED_ORIGINS = ORIGINAL_ENV.ALLOWED_ORIGINS;
	process.env.OPENAI_API_KEY = ORIGINAL_ENV.OPENAI_API_KEY;
	process.env.SESSION_SIGNING_SECRET = ORIGINAL_ENV.SESSION_SIGNING_SECRET;
	setNodeEnv(ORIGINAL_ENV.NODE_ENV);
};

const resetTestState = () => {
	restoreEnvironment();
	delete process.env.ALLOWED_ORIGINS;
	delete process.env.OPENAI_API_KEY;
	delete process.env.SESSION_SIGNING_SECRET;
	setNodeEnv("test");
};

const run = (name: string, assertion: () => void) => {
	resetTestState();

	try {
		assertion();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
};

export const runProductionConfigTests = async () => {
	run(
		"validateProductionServerConfig allows incomplete config outside production",
		() => {
			const result = validateProductionServerConfig({ requiresOpenAi: true });
			assert.deepEqual(result, { ok: true });
		},
	);

	run(
		"validateProductionServerConfig requires secure defaults in production",
		() => {
			setNodeEnv("production");

			const result = validateProductionServerConfig();

			assert.equal(result.ok, false);
			if (result.ok) return;

			assert.deepEqual(result.missing, [
				"ALLOWED_ORIGINS",
				"SESSION_SIGNING_SECRET",
			]);
		},
	);

	run(
		"validateProductionServerConfig requires OPENAI_API_KEY when requested in production",
		() => {
			setNodeEnv("production");
			process.env.ALLOWED_ORIGINS = "https://avatar.example";
			process.env.SESSION_SIGNING_SECRET = "session-secret";

			const result = validateProductionServerConfig({ requiresOpenAi: true });

			assert.equal(result.ok, false);
			if (result.ok) return;

			assert.deepEqual(result.missing, ["OPENAI_API_KEY"]);
		},
	);

	run(
		"validateProductionServerConfig passes with required production values",
		() => {
			setNodeEnv("production");
			process.env.ALLOWED_ORIGINS = "https://avatar.example";
			process.env.SESSION_SIGNING_SECRET = "session-secret";
			process.env.OPENAI_API_KEY = "test-key";

			const result = validateProductionServerConfig({ requiresOpenAi: true });

			assert.deepEqual(result, { ok: true });
		},
	);
};
