import assert from "node:assert/strict";
import { getUserThreadOwnerKey } from "../../lib/auth";
import {
	createAuthCookie,
	getValidatedCredentials,
	resolveRequestIdentity,
} from "../../lib/server/auth";
import { resetSessionStateForTests } from "../../lib/server/session";
import {
	createUser,
	resetUserStoreStateForTests,
} from "../../lib/server/user-store";

const ORIGINAL_ENV = {
	AUTH_COOKIE_MAX_AGE_SECONDS: process.env.AUTH_COOKIE_MAX_AGE_SECONDS,
	AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
	AUTH_SIGNING_SECRET: process.env.AUTH_SIGNING_SECRET,
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
	process.env.AUTH_COOKIE_MAX_AGE_SECONDS =
		ORIGINAL_ENV.AUTH_COOKIE_MAX_AGE_SECONDS;
	process.env.AUTH_COOKIE_NAME = ORIGINAL_ENV.AUTH_COOKIE_NAME;
	process.env.AUTH_SIGNING_SECRET = ORIGINAL_ENV.AUTH_SIGNING_SECRET;
	process.env.SESSION_COOKIE_MAX_AGE_SECONDS =
		ORIGINAL_ENV.SESSION_COOKIE_MAX_AGE_SECONDS;
	process.env.SESSION_COOKIE_NAME = ORIGINAL_ENV.SESSION_COOKIE_NAME;
	process.env.SESSION_SIGNING_SECRET = ORIGINAL_ENV.SESSION_SIGNING_SECRET;
	setNodeEnv(ORIGINAL_ENV.NODE_ENV);
};

const resetTestState = () => {
	restoreEnvironment();
	resetSessionStateForTests();
	resetUserStoreStateForTests();
	delete process.env.AUTH_COOKIE_MAX_AGE_SECONDS;
	delete process.env.AUTH_COOKIE_NAME;
	delete process.env.AUTH_SIGNING_SECRET;
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

const getCookiePair = (setCookieHeader: string | null | undefined) => {
	assert.ok(setCookieHeader);
	return setCookieHeader.split(";")[0] ?? "";
};

export const runAuthTests = async () => {
	await run(
		"resolveRequestIdentity creates a guest session when no cookies exist",
		async () => {
			process.env.AUTH_SIGNING_SECRET = "auth-secret";
			process.env.SESSION_SIGNING_SECRET = "session-secret";

			const identity = await resolveRequestIdentity(
				new Request("https://avatar.example/api/auth/session", {
					method: "GET",
				}),
			);

			assert.equal(identity.ok, true);
			if (!identity.ok) return;

			assert.equal(identity.user, null);
			assert.equal(identity.session.isAuthenticated, false);
			assert.equal(identity.threadOwnerKey, `guest:${identity.sessionId}`);
			assert.match(
				identity.headers.get("set-cookie") ?? "",
				/^avatar_session=v1\.[0-9a-f-]+\.[A-Za-z0-9_-]+; /,
			);
		},
	);

	await run(
		"resolveRequestIdentity resolves authenticated users from a signed auth cookie",
		async () => {
			process.env.AUTH_SIGNING_SECRET = "auth-secret";
			process.env.SESSION_SIGNING_SECRET = "session-secret";

			const user = await createUser({
				email: "sara@example.com",
				name: "Sara",
				password: "password-123",
			});
			assert.ok(user);

			const guestIdentity = await resolveRequestIdentity(
				new Request("https://avatar.example/api/auth/session", {
					method: "GET",
				}),
			);

			assert.equal(guestIdentity.ok, true);
			if (!guestIdentity.ok) return;

			const identity = await resolveRequestIdentity(
				new Request("https://avatar.example/api/auth/session", {
					method: "GET",
					headers: {
						cookie: `${getCookiePair(
							guestIdentity.headers.get("set-cookie"),
						)}; ${getCookiePair(createAuthCookie(user.id))}`,
					},
				}),
			);

			assert.equal(identity.ok, true);
			if (!identity.ok) return;

			assert.deepEqual(identity.user, user);
			assert.equal(identity.session.isAuthenticated, true);
			assert.equal(identity.threadOwnerKey, getUserThreadOwnerKey(user.id));
			assert.equal(identity.headers.get("set-cookie"), null);
		},
	);

	await run(
		"resolveRequestIdentity clears invalid auth cookies while keeping the guest session",
		async () => {
			process.env.AUTH_SIGNING_SECRET = "auth-secret";
			process.env.SESSION_SIGNING_SECRET = "session-secret";

			const guestIdentity = await resolveRequestIdentity(
				new Request("https://avatar.example/api/auth/session", {
					method: "GET",
				}),
			);

			assert.equal(guestIdentity.ok, true);
			if (!guestIdentity.ok) return;

			const identity = await resolveRequestIdentity(
				new Request("https://avatar.example/api/auth/session", {
					method: "GET",
					headers: {
						cookie: `${getCookiePair(
							guestIdentity.headers.get("set-cookie"),
						)}; avatar_auth=v1.invalid.signature`,
					},
				}),
			);

			assert.equal(identity.ok, true);
			if (!identity.ok) return;

			assert.equal(identity.user, null);
			assert.equal(identity.session.isAuthenticated, false);
			assert.match(identity.headers.get("set-cookie") ?? "", /avatar_auth=/);
			assert.match(identity.headers.get("set-cookie") ?? "", /Max-Age=0/);
		},
	);

	await run("getValidatedCredentials validates auth payloads", () => {
		assert.deepEqual(getValidatedCredentials(null), {
			ok: false,
			message: "Request body must be a JSON object.",
		});
		assert.deepEqual(
			getValidatedCredentials({ email: "bad", password: "123" }),
			{
				ok: false,
				message: "A valid email address is required.",
			},
		);
		assert.deepEqual(
			getValidatedCredentials({
				email: "sara@example.com",
				password: "password-123",
			}),
			{
				ok: true,
				value: {
					email: "sara@example.com",
					password: "password-123",
				},
			},
		);
	});
};
