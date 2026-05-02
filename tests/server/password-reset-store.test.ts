import assert from "node:assert/strict";
import {
	requestPasswordResetCode,
	resetPasswordResetStoreStateForTests,
	resetPasswordWithCode,
} from "../../lib/server/password-reset-store";
import {
	authenticateUser,
	createUser,
	resetUserStoreStateForTests,
} from "../../lib/server/user-store";

const ORIGINAL_ENV = {
	AUTH_SIGNING_SECRET: process.env.AUTH_SIGNING_SECRET,
	PASSWORD_RESET_PREFIX: process.env.PASSWORD_RESET_PREFIX,
	RATE_LIMIT_PREFIX: process.env.RATE_LIMIT_PREFIX,
	UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
	USER_STORE_PREFIX: process.env.USER_STORE_PREFIX,
};

const restoreEnvironment = () => {
	process.env.AUTH_SIGNING_SECRET = ORIGINAL_ENV.AUTH_SIGNING_SECRET;
	process.env.PASSWORD_RESET_PREFIX = ORIGINAL_ENV.PASSWORD_RESET_PREFIX;
	process.env.RATE_LIMIT_PREFIX = ORIGINAL_ENV.RATE_LIMIT_PREFIX;
	process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_ENV.UPSTASH_REDIS_REST_TOKEN;
	process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_ENV.UPSTASH_REDIS_REST_URL;
	process.env.USER_STORE_PREFIX = ORIGINAL_ENV.USER_STORE_PREFIX;
};

const resetTestState = () => {
	restoreEnvironment();
	resetPasswordResetStoreStateForTests();
	resetUserStoreStateForTests();
	delete process.env.AUTH_SIGNING_SECRET;
	delete process.env.PASSWORD_RESET_PREFIX;
	delete process.env.RATE_LIMIT_PREFIX;
	delete process.env.UPSTASH_REDIS_REST_TOKEN;
	delete process.env.UPSTASH_REDIS_REST_URL;
	delete process.env.USER_STORE_PREFIX;
};

const run = async (name: string, assertion: () => Promise<void> | void) => {
	resetTestState();

	try {
		await assertion();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
};

export const runPasswordResetStoreTests = async () => {
	await run("password reset code updates the account password", async () => {
		process.env.AUTH_SIGNING_SECRET = "test-auth-secret";
		const user = await createUser({
			email: "sara@example.com",
			name: "Sara",
			password: "old-password",
		});
		assert.ok(user);

		const code = await requestPasswordResetCode("SARA@example.com");
		assert.match(code ?? "", /^\d{6}$/);

		const resetUser = await resetPasswordWithCode({
			email: "sara@example.com",
			code: code ?? "",
			password: "new-password",
		});
		assert.deepEqual(resetUser, user);
		assert.deepEqual(
			await authenticateUser({
				email: "sara@example.com",
				password: "new-password",
			}),
			user,
		);
		assert.equal(
			await resetPasswordWithCode({
				email: "sara@example.com",
				code: "000000",
				password: "another-password",
			}),
			null,
		);
	});

	await run("password reset code is tied to the account email", async () => {
		process.env.AUTH_SIGNING_SECRET = "test-auth-secret";
		const user = await createUser({
			email: "sara@example.com",
			name: "Sara",
			password: "old-password",
		});
		assert.ok(user);

		const code = await requestPasswordResetCode("sara@example.com");
		assert.equal(
			await resetPasswordWithCode({
				email: "other@example.com",
				code: code ?? "",
				password: "new-password",
			}),
			null,
		);
		assert.deepEqual(
			await authenticateUser({
				email: "sara@example.com",
				password: "old-password",
			}),
			user,
		);
	});

	await run(
		"password reset code is not issued for unknown accounts",
		async () => {
			assert.equal(await requestPasswordResetCode("missing@example.com"), null);
		},
	);
};
