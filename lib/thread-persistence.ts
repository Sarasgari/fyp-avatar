const PERSISTED_THREAD_SNAPSHOT_VERSION = 1;

export const PERSISTED_THREAD_STORAGE_PREFIX = "fyp-avatar:thread:v1";

export const getPersistedThreadStorageKey = (ownerKey: string) =>
	`${PERSISTED_THREAD_STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;

export type PersistableThreadExternalState = {
	headId?: string | null;
	messages: unknown[];
	[key: string]: unknown;
};

export type PersistedThreadSnapshot = {
	version: typeof PERSISTED_THREAD_SNAPSHOT_VERSION;
	savedAt: string;
	snapshot: PersistableThreadExternalState;
};

export const createEmptyThreadExternalState =
	(): PersistableThreadExternalState => ({
		headId: null,
		messages: [],
	});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const coercePersistableThreadExternalState = (
	value: unknown,
): PersistableThreadExternalState | null => {
	if (!isRecord(value) || !Array.isArray(value.messages)) {
		return null;
	}

	if (
		value.headId !== undefined &&
		value.headId !== null &&
		typeof value.headId !== "string"
	) {
		return null;
	}

	return {
		...value,
		headId: value.headId ?? null,
		messages: [...value.messages],
	};
};

export const hasPersistedMessages = (
	snapshot: PersistableThreadExternalState | null | undefined,
) => Boolean(snapshot && snapshot.messages.length > 0);

export const createPersistedThreadSnapshot = (
	snapshot: PersistableThreadExternalState,
	now = new Date(),
): PersistedThreadSnapshot => ({
	version: PERSISTED_THREAD_SNAPSHOT_VERSION,
	savedAt: now.toISOString(),
	snapshot,
});

export const serializePersistedThreadSnapshot = (
	snapshot: PersistableThreadExternalState,
	now?: Date,
) => JSON.stringify(createPersistedThreadSnapshot(snapshot, now));

export const coercePersistedThreadSnapshot = (
	value: unknown,
): PersistedThreadSnapshot | null => {
	if (!isRecord(value)) {
		return null;
	}

	if (value.version !== PERSISTED_THREAD_SNAPSHOT_VERSION) {
		return null;
	}

	const snapshot =
		typeof value.savedAt === "string"
			? coercePersistableThreadExternalState(value.snapshot)
			: null;

	if (typeof value.savedAt !== "string" || !snapshot) {
		return null;
	}

	return {
		version: PERSISTED_THREAD_SNAPSHOT_VERSION,
		savedAt: value.savedAt,
		snapshot,
	};
};

export const parsePersistedThreadSnapshot = (rawSnapshot: string | null) => {
	if (!rawSnapshot) {
		return null;
	}

	try {
		return coercePersistedThreadSnapshot(JSON.parse(rawSnapshot) as unknown);
	} catch {
		return null;
	}
};
