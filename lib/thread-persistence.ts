import type { ExportedMessageRepository } from "@assistant-ui/core";

const PERSISTED_THREAD_SNAPSHOT_VERSION = 1;

export const PERSISTED_THREAD_STORAGE_KEY = "fyp-avatar:thread:v1";

export type PersistedThreadSnapshot = {
	version: typeof PERSISTED_THREAD_SNAPSHOT_VERSION;
	savedAt: string;
	snapshot: ExportedMessageRepository;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isThreadMessageLike = (value: unknown) => {
	if (!isRecord(value)) return false;

	return (
		typeof value.id === "string" &&
		typeof value.role === "string" &&
		Array.isArray(value.content)
	);
};

const isExportedMessageRepository = (
	value: unknown,
): value is ExportedMessageRepository => {
	if (!isRecord(value) || !Array.isArray(value.messages)) {
		return false;
	}

	if (
		value.headId !== undefined &&
		value.headId !== null &&
		typeof value.headId !== "string"
	) {
		return false;
	}

	return value.messages.every((entry) => {
		if (!isRecord(entry)) return false;

		return (
			(entry.parentId === null || typeof entry.parentId === "string") &&
			isThreadMessageLike(entry.message)
		);
	});
};

export const hasPersistedMessages = (
	snapshot: ExportedMessageRepository | null | undefined,
) => Boolean(snapshot && snapshot.messages.length > 0);

export const createPersistedThreadSnapshot = (
	snapshot: ExportedMessageRepository,
	now = new Date(),
): PersistedThreadSnapshot => ({
	version: PERSISTED_THREAD_SNAPSHOT_VERSION,
	savedAt: now.toISOString(),
	snapshot,
});

export const serializePersistedThreadSnapshot = (
	snapshot: ExportedMessageRepository,
	now?: Date,
) => JSON.stringify(createPersistedThreadSnapshot(snapshot, now));

export const parsePersistedThreadSnapshot = (
	rawSnapshot: string | null,
): PersistedThreadSnapshot | null => {
	if (!rawSnapshot) {
		return null;
	}

	try {
		const parsed = JSON.parse(rawSnapshot) as unknown;

		if (!isRecord(parsed)) {
			return null;
		}

		if (parsed.version !== PERSISTED_THREAD_SNAPSHOT_VERSION) {
			return null;
		}

		if (
			typeof parsed.savedAt !== "string" ||
			!isExportedMessageRepository(parsed.snapshot)
		) {
			return null;
		}

		return {
			version: PERSISTED_THREAD_SNAPSHOT_VERSION,
			savedAt: parsed.savedAt,
			snapshot: parsed.snapshot,
		};
	} catch {
		return null;
	}
};
