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

const getPersistedMessageId = (messageItem: unknown) => {
	if (!isRecord(messageItem) || !isRecord(messageItem.message)) {
		return null;
	}

	const { id } = messageItem.message;
	return typeof id === "string" && id.length > 0 ? id : null;
};

const normalizePersistedMessages = (messages: unknown[]) => {
	const pendingMessages = messages.flatMap((messageItem) => {
		const messageId = getPersistedMessageId(messageItem);
		if (!messageId || !isRecord(messageItem)) {
			return [];
		}

		const { parentId } = messageItem;
		if (
			parentId !== undefined &&
			parentId !== null &&
			typeof parentId !== "string"
		) {
			return [];
		}

		return [
			{
				id: messageId,
				item: {
					...messageItem,
					parentId: parentId ?? null,
				},
			},
		];
	});

	const normalizedMessages: unknown[] = [];
	const acceptedIds = new Set<string>();
	const duplicateIds = new Set<string>();
	let previousAcceptedCount = -1;

	while (
		pendingMessages.length > 0 &&
		previousAcceptedCount !== normalizedMessages.length
	) {
		previousAcceptedCount = normalizedMessages.length;

		for (let index = 0; index < pendingMessages.length; index += 1) {
			const candidate = pendingMessages[index];
			if (!candidate || duplicateIds.has(candidate.id)) {
				pendingMessages.splice(index, 1);
				index -= 1;
				continue;
			}

			if (acceptedIds.has(candidate.id)) {
				duplicateIds.add(candidate.id);
				pendingMessages.splice(index, 1);
				index -= 1;
				continue;
			}

			const parentId = candidate.item.parentId;
			if (parentId !== null && !acceptedIds.has(parentId)) {
				continue;
			}

			acceptedIds.add(candidate.id);
			normalizedMessages.push(candidate.item);
			pendingMessages.splice(index, 1);
			index -= 1;
		}
	}

	return normalizedMessages;
};

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

	const messages = normalizePersistedMessages(value.messages);
	const messageIds = new Set(
		messages.map(getPersistedMessageId).filter(Boolean),
	);
	const headId =
		value.headId && messageIds.has(value.headId)
			? value.headId
			: (getPersistedMessageId(messages.at(-1)) ?? null);

	return {
		...value,
		headId,
		messages,
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
