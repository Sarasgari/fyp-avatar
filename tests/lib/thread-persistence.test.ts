import assert from "node:assert/strict";
import {
	createPersistedThreadSnapshot,
	hasPersistedMessages,
	parsePersistedThreadSnapshot,
	serializePersistedThreadSnapshot,
} from "../../lib/thread-persistence";

const run = (name: string, assertion: () => void) => {
	try {
		assertion();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
};

export const runThreadPersistenceTests = async () => {
	run(
		"serializePersistedThreadSnapshot round-trips a saved conversation",
		() => {
			const rawSnapshot = serializePersistedThreadSnapshot(
				{
					headId: "assistant-1",
					messages: [
						{
							parentId: null,
							message: {
								id: "user-1",
								role: "user",
								parts: [{ type: "text", text: "Hello" }],
							},
						},
						{
							parentId: "user-1",
							message: {
								id: "assistant-1",
								role: "assistant",
								parts: [{ type: "text", text: "Hi there" }],
							},
						},
					],
				},
				new Date("2026-04-28T12:00:00.000Z"),
			);

			const parsedSnapshot = parsePersistedThreadSnapshot(rawSnapshot);
			assert.ok(parsedSnapshot);
			assert.equal(parsedSnapshot.savedAt, "2026-04-28T12:00:00.000Z");
			assert.equal(parsedSnapshot.snapshot.headId, "assistant-1");
			assert.equal(parsedSnapshot.snapshot.messages.length, 2);
			assert.equal(hasPersistedMessages(parsedSnapshot.snapshot), true);
		},
	);

	run("parsePersistedThreadSnapshot repairs a stale head id", () => {
		const parsedSnapshot = parsePersistedThreadSnapshot(
			JSON.stringify({
				version: 1,
				savedAt: "2026-04-28T12:00:00.000Z",
				snapshot: {
					headId: "missing-message",
					messages: [
						{
							parentId: null,
							message: {
								id: "user-1",
								role: "user",
								parts: [{ type: "text", text: "Hello" }],
							},
						},
						{
							parentId: "user-1",
							message: {
								id: "assistant-1",
								role: "assistant",
								parts: [{ type: "text", text: "Hi there" }],
							},
						},
					],
				},
			}),
		);

		assert.ok(parsedSnapshot);
		assert.equal(parsedSnapshot.snapshot.headId, "assistant-1");
	});

	run("parsePersistedThreadSnapshot drops orphaned messages", () => {
		const parsedSnapshot = parsePersistedThreadSnapshot(
			JSON.stringify({
				version: 1,
				savedAt: "2026-04-28T12:00:00.000Z",
				snapshot: {
					headId: "orphaned-assistant",
					messages: [
						{
							parentId: null,
							message: {
								id: "user-1",
								role: "user",
								parts: [{ type: "text", text: "Hello" }],
							},
						},
						{
							parentId: "missing-user",
							message: {
								id: "orphaned-assistant",
								role: "assistant",
								parts: [{ type: "text", text: "Lost" }],
							},
						},
					],
				},
			}),
		);

		assert.ok(parsedSnapshot);
		assert.equal(parsedSnapshot.snapshot.headId, "user-1");
		assert.equal(parsedSnapshot.snapshot.messages.length, 1);
	});

	run("parsePersistedThreadSnapshot restores out-of-order parents", () => {
		const parsedSnapshot = parsePersistedThreadSnapshot(
			JSON.stringify({
				version: 1,
				savedAt: "2026-04-28T12:00:00.000Z",
				snapshot: {
					headId: "assistant-1",
					messages: [
						{
							parentId: "user-1",
							message: {
								id: "assistant-1",
								role: "assistant",
								parts: [{ type: "text", text: "Hi there" }],
							},
						},
						{
							parentId: null,
							message: {
								id: "user-1",
								role: "user",
								parts: [{ type: "text", text: "Hello" }],
							},
						},
					],
				},
			}),
		);

		assert.ok(parsedSnapshot);
		assert.equal(parsedSnapshot.snapshot.headId, "assistant-1");
		assert.deepEqual(
			parsedSnapshot.snapshot.messages.map(
				(messageItem) =>
					(messageItem as { message: { id: string } }).message.id,
			),
			["user-1", "assistant-1"],
		);
	});

	run("parsePersistedThreadSnapshot ignores invalid JSON", () => {
		assert.equal(parsePersistedThreadSnapshot("{not-json"), null);
	});

	run("parsePersistedThreadSnapshot ignores unsupported versions", () => {
		assert.equal(
			parsePersistedThreadSnapshot(
				JSON.stringify({
					version: 999,
					savedAt: "2026-04-28T12:00:00.000Z",
					snapshot: { headId: null, messages: [] },
				}),
			),
			null,
		);
	});

	run("parsePersistedThreadSnapshot ignores malformed snapshots", () => {
		assert.equal(
			parsePersistedThreadSnapshot(
				JSON.stringify({
					version: 1,
					savedAt: "2026-04-28T12:00:00.000Z",
					snapshot: {
						headId: 42,
						messages: [],
					},
				}),
			),
			null,
		);
	});

	run(
		"createPersistedThreadSnapshot keeps empty-thread metadata explicit",
		() => {
			const snapshot = createPersistedThreadSnapshot(
				{ headId: null, messages: [] },
				new Date("2026-04-28T12:00:00.000Z"),
			);

			assert.equal(snapshot.savedAt, "2026-04-28T12:00:00.000Z");
			assert.equal(hasPersistedMessages(snapshot.snapshot), false);
		},
	);
};
