import assert from "node:assert/strict";
import {
	consumeRateLimit,
	ensureAllowedOrigin,
	getClientIp,
	pickMostConstrainedRateLimit,
	resetRateLimitStateForTests,
} from "../../lib/server/api";

const ORIGINAL_ENV = {
	ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
	UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
	UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	RATE_LIMIT_PREFIX: process.env.RATE_LIMIT_PREFIX,
};

const restoreEnvironment = () => {
	process.env.ALLOWED_ORIGINS = ORIGINAL_ENV.ALLOWED_ORIGINS;
	process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_ENV.UPSTASH_REDIS_REST_URL;
	process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_ENV.UPSTASH_REDIS_REST_TOKEN;
	process.env.RATE_LIMIT_PREFIX = ORIGINAL_ENV.RATE_LIMIT_PREFIX;
};

const resetTestState = () => {
	restoreEnvironment();
	resetRateLimitStateForTests();
	delete process.env.ALLOWED_ORIGINS;
	delete process.env.UPSTASH_REDIS_REST_URL;
	delete process.env.UPSTASH_REDIS_REST_TOKEN;
	delete process.env.RATE_LIMIT_PREFIX;
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

export const runApiTests = async () => {
	await run(
		"consumeRateLimit blocks after the configured limit when using memory fallback",
		async () => {
			const first = await consumeRateLimit({
				key: "chat:test-memory",
				limit: 2,
				windowMs: 30_000,
			});
			const second = await consumeRateLimit({
				key: "chat:test-memory",
				limit: 2,
				windowMs: 30_000,
			});
			const third = await consumeRateLimit({
				key: "chat:test-memory",
				limit: 2,
				windowMs: 30_000,
			});

			assert.equal(first.allowed, true);
			assert.equal(first.remaining, 1);
			assert.equal(second.allowed, true);
			assert.equal(second.remaining, 0);
			assert.equal(third.allowed, false);
			assert.equal(third.remaining, 0);
			assert.match(String(third.retryAfterSeconds), /^[1-9]\d*$/);
		},
	);

	await run(
		"ensureAllowedOrigin allows requests when no allowlist is configured",
		() => {
			const request = new Request("https://avatar.example/api/chat", {
				method: "POST",
			});

			assert.deepEqual(ensureAllowedOrigin(request), {
				allowed: true,
				origin: null,
			});
		},
	);

	await run(
		"ensureAllowedOrigin rejects requests without origin metadata when an allowlist is configured",
		() => {
			process.env.ALLOWED_ORIGINS = "https://avatar.example";

			const request = new Request("https://avatar.example/api/chat", {
				method: "POST",
			});

			assert.deepEqual(ensureAllowedOrigin(request), {
				allowed: false,
				message: "Missing Origin or Referer header.",
				origin: null,
			});
		},
	);

	await run(
		"ensureAllowedOrigin allows a request with a matching Origin header",
		() => {
			process.env.ALLOWED_ORIGINS =
				"https://avatar.example, https://staging.avatar.example";

			const request = new Request("https://avatar.example/api/chat", {
				method: "POST",
				headers: {
					Origin: "https://staging.avatar.example",
				},
			});

			assert.deepEqual(ensureAllowedOrigin(request), {
				allowed: true,
				origin: "https://staging.avatar.example",
			});
		},
	);

	await run(
		"ensureAllowedOrigin falls back to the Referer origin when Origin is absent",
		() => {
			process.env.ALLOWED_ORIGINS = "https://avatar.example";

			const request = new Request("https://avatar.example/api/chat", {
				method: "POST",
				headers: {
					Referer: "https://avatar.example/thread/123",
				},
			});

			assert.deepEqual(ensureAllowedOrigin(request), {
				allowed: true,
				origin: "https://avatar.example",
			});
		},
	);

	await run(
		"ensureAllowedOrigin rejects a request from an unlisted origin",
		() => {
			process.env.ALLOWED_ORIGINS = "https://avatar.example";

			const request = new Request("https://avatar.example/api/chat", {
				method: "POST",
				headers: {
					Origin: "https://evil.example",
				},
			});

			assert.deepEqual(ensureAllowedOrigin(request), {
				allowed: false,
				message: "Origin is not allowed.",
				origin: "https://evil.example",
			});
		},
	);

	await run("getClientIp prefers the first forwarded address", () => {
		const request = new Request("https://avatar.example/api/chat", {
			method: "POST",
			headers: {
				"x-forwarded-for": "203.0.113.1, 198.51.100.20",
			},
		});

		assert.equal(getClientIp(request), "203.0.113.1");
	});

	await run(
		"pickMostConstrainedRateLimit prefers blocked results over allowed ones",
		() => {
			const selected = pickMostConstrainedRateLimit(
				{
					allowed: true,
					limit: 60,
					remaining: 52,
					resetAt: 1_000,
					retryAfterSeconds: 1,
				},
				{
					allowed: false,
					limit: 30,
					remaining: 0,
					resetAt: 2_000,
					retryAfterSeconds: 30,
				},
			);

			assert.equal(selected.allowed, false);
			assert.equal(selected.limit, 30);
		},
	);
};
