import assert from "node:assert/strict";
import { ExportedMessageRepository } from "@assistant-ui/core";
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
					...ExportedMessageRepository.fromArray([
						{
							id: "user-1",
							role: "user",
							content: "Hello",
						},
						{
							id: "assistant-1",
							role: "assistant",
							content: "Hi there",
							status: {
								type: "complete",
								reason: "stop",
							},
						},
					]),
					headId: "assistant-1",
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
						headId: null,
						messages: [{ parentId: null, message: { role: "user" } }],
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
