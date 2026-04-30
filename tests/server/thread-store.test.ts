import assert from "node:assert/strict";
import {
	deleteThreadSnapshot,
	loadThreadSnapshot,
	migrateThreadSnapshot,
	resetThreadStoreStateForTests,
	saveThreadSnapshot,
} from "../../lib/server/thread-store";
import { createPersistedThreadSnapshot } from "../../lib/thread-persistence";

const ORIGINAL_ENV = {
	RATE_LIMIT_PREFIX: process.env.RATE_LIMIT_PREFIX,
	THREAD_STORE_PREFIX: process.env.THREAD_STORE_PREFIX,
	THREAD_STORE_TTL_SECONDS: process.env.THREAD_STORE_TTL_SECONDS,
	UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
};

const restoreEnvironment = () => {
	process.env.RATE_LIMIT_PREFIX = ORIGINAL_ENV.RATE_LIMIT_PREFIX;
	process.env.THREAD_STORE_PREFIX = ORIGINAL_ENV.THREAD_STORE_PREFIX;
	process.env.THREAD_STORE_TTL_SECONDS = ORIGINAL_ENV.THREAD_STORE_TTL_SECONDS;
	process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_ENV.UPSTASH_REDIS_REST_TOKEN;
	process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_ENV.UPSTASH_REDIS_REST_URL;
};

const resetTestState = () => {
	restoreEnvironment();
	resetThreadStoreStateForTests();
	delete process.env.RATE_LIMIT_PREFIX;
	delete process.env.THREAD_STORE_PREFIX;
	delete process.env.THREAD_STORE_TTL_SECONDS;
	delete process.env.UPSTASH_REDIS_REST_TOKEN;
	delete process.env.UPSTASH_REDIS_REST_URL;
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

export const runThreadStoreTests = async () => {
	await run(
		"thread store saves and loads a snapshot when using the memory fallback",
		async () => {
			const snapshot = createPersistedThreadSnapshot(
				{
					headId: "assistant-1",
					messages: [
						{
							parentId: null,
							message: {
								id: "user-1",
								role: "user",
								content: [{ type: "text", text: "Hello" }],
								createdAt: new Date("2026-04-28T12:00:00.000Z"),
								attachments: [],
								metadata: {
									custom: {},
								},
							},
						},
						{
							parentId: "user-1",
							message: {
								id: "assistant-1",
								role: "assistant",
								content: [{ type: "text", text: "Hi there" }],
								createdAt: new Date("2026-04-28T12:00:01.000Z"),
								status: {
									type: "complete",
									reason: "stop",
								},
								metadata: {
									custom: {},
									steps: [],
									unstable_annotations: [],
									unstable_data: [],
									unstable_state: null,
								},
							},
						},
					],
				},
				new Date("2026-04-28T12:00:02.000Z"),
			);

			await saveThreadSnapshot("session-1", snapshot);
			const loadedSnapshot = await loadThreadSnapshot("session-1");

			assert.deepEqual(loadedSnapshot, snapshot);
		},
	);

	await run("thread store deletes a saved snapshot", async () => {
		const snapshot = createPersistedThreadSnapshot(
			{
				headId: null,
				messages: [],
			},
			new Date("2026-04-28T12:00:00.000Z"),
		);

		await saveThreadSnapshot("session-2", snapshot);
		await deleteThreadSnapshot("session-2");

		assert.equal(await loadThreadSnapshot("session-2"), null);
	});

	await run(
		"thread store migrates the newest snapshot from a guest owner to a user owner",
		async () => {
			const guestSnapshot = createPersistedThreadSnapshot(
				{
					headId: "assistant-1",
					messages: [],
				},
				new Date("2026-04-28T12:00:00.000Z"),
			);
			const userSnapshot = createPersistedThreadSnapshot(
				{
					headId: "assistant-2",
					messages: [],
				},
				new Date("2026-04-28T12:05:00.000Z"),
			);

			await saveThreadSnapshot("guest:session-1", guestSnapshot);
			await saveThreadSnapshot("user:user-1", userSnapshot);

			const migratedSnapshot = await migrateThreadSnapshot({
				fromOwnerKey: "guest:session-1",
				toOwnerKey: "user:user-1",
			});

			assert.deepEqual(migratedSnapshot, userSnapshot);
			assert.equal(await loadThreadSnapshot("guest:session-1"), null);
			assert.deepEqual(await loadThreadSnapshot("user:user-1"), userSnapshot);
		},
	);
};
