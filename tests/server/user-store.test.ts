import assert from "node:assert/strict";
import {
	authenticateUser,
	createUser,
	getUserById,
	resetUserStoreStateForTests,
} from "../../lib/server/user-store";

const ORIGINAL_ENV = {
	RATE_LIMIT_PREFIX: process.env.RATE_LIMIT_PREFIX,
	THREAD_STORE_PREFIX: process.env.THREAD_STORE_PREFIX,
	UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
	USER_STORE_PREFIX: process.env.USER_STORE_PREFIX,
};

const restoreEnvironment = () => {
	process.env.RATE_LIMIT_PREFIX = ORIGINAL_ENV.RATE_LIMIT_PREFIX;
	process.env.THREAD_STORE_PREFIX = ORIGINAL_ENV.THREAD_STORE_PREFIX;
	process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_ENV.UPSTASH_REDIS_REST_TOKEN;
	process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_ENV.UPSTASH_REDIS_REST_URL;
	process.env.USER_STORE_PREFIX = ORIGINAL_ENV.USER_STORE_PREFIX;
};

const resetTestState = () => {
	restoreEnvironment();
	resetUserStoreStateForTests();
	delete process.env.RATE_LIMIT_PREFIX;
	delete process.env.THREAD_STORE_PREFIX;
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

export const runUserStoreTests = async () => {
	await run(
		"createUser normalizes email addresses and authenticateUser accepts the stored password",
		async () => {
			const user = await createUser({
				email: "  Sara@example.com ",
				name: "Sara",
				password: "correct horse battery staple",
			});

			assert.ok(user);
			assert.equal(user.email, "sara@example.com");
			assert.equal(user.name, "Sara");

			const authenticatedUser = await authenticateUser({
				email: "SARA@example.com",
				password: "correct horse battery staple",
			});

			assert.deepEqual(authenticatedUser, user);
		},
	);

	await run("createUser rejects duplicate email addresses", async () => {
		const firstUser = await createUser({
			email: "sara@example.com",
			name: "Sara",
			password: "password-123",
		});
		const secondUser = await createUser({
			email: "SARA@example.com",
			name: "Sara Duplicate",
			password: "password-456",
		});

		assert.ok(firstUser);
		assert.equal(secondUser, null);
	});

	await run("authenticateUser rejects incorrect passwords", async () => {
		const user = await createUser({
			email: "sara@example.com",
			name: "Sara",
			password: "password-123",
		});

		assert.ok(user);
		assert.equal(
			await authenticateUser({
				email: "sara@example.com",
				password: "incorrect-password",
			}),
			null,
		);
	});

	await run("getUserById returns stored users by id", async () => {
		const user = await createUser({
			email: "sara@example.com",
			name: "Sara",
			password: "password-123",
		});

		assert.ok(user);
		assert.deepEqual(await getUserById(user.id), user);
	});
};
