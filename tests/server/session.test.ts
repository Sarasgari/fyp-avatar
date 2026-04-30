import assert from "node:assert/strict";
import {
	resetSessionStateForTests,
	resolveSession,
} from "../../lib/server/session";

const ORIGINAL_ENV = {
	NODE_ENV: process.env.NODE_ENV,
	SESSION_COOKIE_MAX_AGE_SECONDS: process.env.SESSION_COOKIE_MAX_AGE_SECONDS,
	SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
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
	setNodeEnv(ORIGINAL_ENV.NODE_ENV);
	process.env.SESSION_COOKIE_MAX_AGE_SECONDS =
		ORIGINAL_ENV.SESSION_COOKIE_MAX_AGE_SECONDS;
	process.env.SESSION_COOKIE_NAME = ORIGINAL_ENV.SESSION_COOKIE_NAME;
	process.env.SESSION_SIGNING_SECRET = ORIGINAL_ENV.SESSION_SIGNING_SECRET;
};

const resetTestState = () => {
	restoreEnvironment();
	resetSessionStateForTests();
	delete process.env.SESSION_COOKIE_MAX_AGE_SECONDS;
	delete process.env.SESSION_COOKIE_NAME;
	delete process.env.SESSION_SIGNING_SECRET;
	setNodeEnv("test");
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

const getCookieValue = (setCookieHeader: string | undefined) => {
	assert.ok(setCookieHeader);
	return setCookieHeader.split(";")[0]?.split("=")[1] ?? "";
};

export const runSessionTests = async () => {
	await run(
		"resolveSession creates a signed session cookie when none exists",
		() => {
			process.env.SESSION_SIGNING_SECRET = "test-secret";

			const session = resolveSession(
				new Request("https://avatar.example/api/chat", {
					method: "POST",
				}),
			);

			assert.equal(session.ok, true);
			if (!session.ok) return;
			assert.match(session.sessionId, /^[0-9a-f-]{36}$/i);
			assert.match(
				session.setCookieHeader ?? "",
				/^avatar_session=v1\.[0-9a-f-]+\.[A-Za-z0-9_-]+; /,
			);
		},
	);

	await run("resolveSession reuses a valid signed session cookie", () => {
		process.env.SESSION_SIGNING_SECRET = "test-secret";

		const initialSession = resolveSession(
			new Request("https://avatar.example/api/chat", {
				method: "POST",
			}),
		);

		assert.equal(initialSession.ok, true);
		if (!initialSession.ok) return;

		const session = resolveSession(
			new Request("https://avatar.example/api/chat", {
				method: "POST",
				headers: {
					cookie: `avatar_session=${getCookieValue(
						initialSession.setCookieHeader,
					)}`,
				},
			}),
		);

		assert.equal(session.ok, true);
		if (!session.ok) return;
		assert.equal(session.sessionId, initialSession.sessionId);
		assert.equal(session.setCookieHeader, undefined);
	});

	await run("resolveSession rotates an invalid session cookie", () => {
		process.env.SESSION_SIGNING_SECRET = "test-secret";

		const session = resolveSession(
			new Request("https://avatar.example/api/chat", {
				method: "POST",
				headers: {
					cookie: "avatar_session=v1.invalid.signature",
				},
			}),
		);

		assert.equal(session.ok, true);
		if (!session.ok) return;
		assert.notEqual(session.sessionId, "invalid");
		assert.ok(session.setCookieHeader);
	});

	await run(
		"resolveSession rejects missing signing secrets in production",
		() => {
			setNodeEnv("production");

			const session = resolveSession(
				new Request("https://avatar.example/api/chat", {
					method: "POST",
				}),
			);

			assert.deepEqual(session, {
				ok: false,
				message: "SESSION_SIGNING_SECRET must be configured in production.",
			});
		},
	);
};
