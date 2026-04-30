import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	coercePersistedThreadSnapshot,
	type PersistedThreadSnapshot,
} from "../thread-persistence";

type UpstashPipelineResponse = {
	error?: string;
	result?: number | string | null;
};

type FileThreadStoreState = Record<string, PersistedThreadSnapshot>;

const DEFAULT_THREAD_STORE_TTL_SECONDS = 60 * 60 * 24 * 30;
const THREAD_SNAPSHOT_STORE = new Map<string, PersistedThreadSnapshot>();
const warningLog = new Set<string>();
let fileThreadStoreTask: Promise<void> = Promise.resolve();

const warnOnce = (message: string, error?: unknown) => {
	if (warningLog.has(message)) {
		return;
	}

	warningLog.add(message);
	console.warn(message, error);
};

const getThreadStorePrefix = () =>
	process.env.THREAD_STORE_PREFIX?.trim() ||
	process.env.RATE_LIMIT_PREFIX?.trim() ||
	"default";

const getThreadStoreTtlSeconds = () => {
	const rawValue = process.env.THREAD_STORE_TTL_SECONDS?.trim();
	if (!rawValue) {
		return DEFAULT_THREAD_STORE_TTL_SECONDS;
	}

	const parsedValue = Number(rawValue);
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return DEFAULT_THREAD_STORE_TTL_SECONDS;
	}

	return Math.floor(parsedValue);
};

const getThreadStoreKey = (ownerKey: string) =>
	`thread_store:${getThreadStorePrefix()}:${ownerKey}`;

const getThreadStoreFilePath = () =>
	process.env.THREAD_STORE_FILE_PATH?.trim() || "";

const hasFileThreadStore = () => getThreadStoreFilePath().length > 0;

const withFileThreadStoreLock = async <T>(work: () => Promise<T>) => {
	const nextTask = fileThreadStoreTask.catch(() => undefined).then(work);
	fileThreadStoreTask = nextTask.then(
		() => undefined,
		() => undefined,
	);
	return nextTask;
};

const readFileThreadStore = async (): Promise<FileThreadStoreState> => {
	const filePath = getThreadStoreFilePath();

	if (!filePath) {
		return {};
	}

	try {
		const rawState = await readFile(filePath, "utf8");
		const parsedState = JSON.parse(rawState) as unknown;

		if (!parsedState || typeof parsedState !== "object") {
			return {};
		}

		return Object.fromEntries(
			Object.entries(parsedState as Record<string, unknown>).flatMap(
				([ownerKey, snapshot]) => {
					const parsedSnapshot = coercePersistedThreadSnapshot(snapshot);
					return parsedSnapshot ? [[ownerKey, parsedSnapshot]] : [];
				},
			),
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {};
		}

		throw error;
	}
};

const writeFileThreadStore = async (state: FileThreadStoreState) => {
	const filePath = getThreadStoreFilePath();
	if (!filePath) {
		return;
	}

	await mkdir(dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
	await writeFile(tempPath, JSON.stringify(state), "utf8");
	await rename(tempPath, filePath);
};

const runUpstashPipeline = async (commands: unknown[][]) => {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token) {
		return null;
	}

	const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(commands),
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`Upstash returned ${response.status}.`);
	}

	return (await response.json()) as UpstashPipelineResponse[];
};

const loadMemoryThreadSnapshot = (ownerKey: string) =>
	THREAD_SNAPSHOT_STORE.get(ownerKey) ?? null;

const saveMemoryThreadSnapshot = (
	ownerKey: string,
	snapshot: PersistedThreadSnapshot,
) => {
	THREAD_SNAPSHOT_STORE.set(ownerKey, snapshot);
};

const deleteMemoryThreadSnapshot = (ownerKey: string) => {
	THREAD_SNAPSHOT_STORE.delete(ownerKey);
};

const loadFileThreadSnapshot = async (ownerKey: string) => {
	return withFileThreadStoreLock(async () => {
		const state = await readFileThreadStore();
		return state[ownerKey] ?? null;
	});
};

const saveFileThreadSnapshot = async (
	ownerKey: string,
	snapshot: PersistedThreadSnapshot,
) => {
	await withFileThreadStoreLock(async () => {
		const state = await readFileThreadStore();
		state[ownerKey] = snapshot;
		await writeFileThreadStore(state);
	});
};

const deleteFileThreadSnapshot = async (ownerKey: string) => {
	await withFileThreadStoreLock(async () => {
		const state = await readFileThreadStore();
		delete state[ownerKey];
		await writeFileThreadStore(state);
	});
};

const migrateFileThreadSnapshot = async ({
	fromOwnerKey,
	toOwnerKey,
}: {
	fromOwnerKey: string;
	toOwnerKey: string;
}) => {
	return withFileThreadStoreLock(async () => {
		const state = await readFileThreadStore();
		const fromSnapshot = state[fromOwnerKey] ?? null;
		const toSnapshot = state[toOwnerKey] ?? null;
		const migratedSnapshot = pickNewerSnapshot(fromSnapshot, toSnapshot);

		if (migratedSnapshot) {
			state[toOwnerKey] = migratedSnapshot;
		}

		if (fromSnapshot) {
			delete state[fromOwnerKey];
		}

		if (migratedSnapshot || fromSnapshot || toSnapshot) {
			await writeFileThreadStore(state);
		}

		return migratedSnapshot;
	});
};

const loadUpstashThreadSnapshot = async (ownerKey: string) => {
	const pipelineResult = await runUpstashPipeline([
		["GET", getThreadStoreKey(ownerKey)],
	]);
	if (!pipelineResult) {
		return loadMemoryThreadSnapshot(ownerKey);
	}

	const rawSnapshot = pipelineResult[0];
	if (rawSnapshot?.error) {
		throw new Error(rawSnapshot.error);
	}

	if (rawSnapshot?.result == null) {
		return null;
	}

	if (typeof rawSnapshot.result !== "string") {
		throw new Error("Thread store returned a non-string snapshot payload.");
	}

	try {
		return coercePersistedThreadSnapshot(
			JSON.parse(rawSnapshot.result) as unknown,
		);
	} catch (error) {
		warnOnce("Stored thread snapshot could not be parsed. Ignoring it.", error);
		return null;
	}
};

const saveUpstashThreadSnapshot = async (
	ownerKey: string,
	snapshot: PersistedThreadSnapshot,
) => {
	const pipelineResult = await runUpstashPipeline([
		[
			"SET",
			getThreadStoreKey(ownerKey),
			JSON.stringify(snapshot),
			"EX",
			String(getThreadStoreTtlSeconds()),
		],
	]);
	if (!pipelineResult) {
		saveMemoryThreadSnapshot(ownerKey, snapshot);
		return;
	}

	if (pipelineResult[0]?.error) {
		throw new Error(pipelineResult[0].error);
	}
};

const deleteUpstashThreadSnapshot = async (ownerKey: string) => {
	const pipelineResult = await runUpstashPipeline([
		["DEL", getThreadStoreKey(ownerKey)],
	]);
	if (!pipelineResult) {
		deleteMemoryThreadSnapshot(ownerKey);
		return;
	}

	if (pipelineResult[0]?.error) {
		throw new Error(pipelineResult[0].error);
	}
};

export const loadThreadSnapshot = async (ownerKey: string) => {
	try {
		if (hasFileThreadStore()) {
			return await loadFileThreadSnapshot(ownerKey);
		}

		return await loadUpstashThreadSnapshot(ownerKey);
	} catch (error) {
		warnOnce(
			"Shared thread storage backend failed. Falling back to in-memory thread storage.",
			error,
		);
		return loadMemoryThreadSnapshot(ownerKey);
	}
};

export const saveThreadSnapshot = async (
	ownerKey: string,
	snapshot: PersistedThreadSnapshot,
) => {
	try {
		if (hasFileThreadStore()) {
			await saveFileThreadSnapshot(ownerKey, snapshot);
			return;
		}

		await saveUpstashThreadSnapshot(ownerKey, snapshot);
	} catch (error) {
		warnOnce(
			"Shared thread storage backend failed. Falling back to in-memory thread storage.",
			error,
		);
		saveMemoryThreadSnapshot(ownerKey, snapshot);
	}
};

export const deleteThreadSnapshot = async (ownerKey: string) => {
	try {
		if (hasFileThreadStore()) {
			await deleteFileThreadSnapshot(ownerKey);
			return;
		}

		await deleteUpstashThreadSnapshot(ownerKey);
	} catch (error) {
		warnOnce(
			"Shared thread storage backend failed. Falling back to in-memory thread storage.",
			error,
		);
		deleteMemoryThreadSnapshot(ownerKey);
	}
};

const pickNewerSnapshot = (
	first: PersistedThreadSnapshot | null,
	second: PersistedThreadSnapshot | null,
) => {
	if (!first) return second;
	if (!second) return first;

	return first.savedAt >= second.savedAt ? first : second;
};

export const migrateThreadSnapshot = async ({
	fromOwnerKey,
	toOwnerKey,
}: {
	fromOwnerKey: string;
	toOwnerKey: string;
}) => {
	if (fromOwnerKey === toOwnerKey) {
		return loadThreadSnapshot(toOwnerKey);
	}

	if (hasFileThreadStore()) {
		return migrateFileThreadSnapshot({ fromOwnerKey, toOwnerKey });
	}

	const [fromSnapshot, toSnapshot] = await Promise.all([
		loadThreadSnapshot(fromOwnerKey),
		loadThreadSnapshot(toOwnerKey),
	]);
	const migratedSnapshot = pickNewerSnapshot(fromSnapshot, toSnapshot);

	if (migratedSnapshot) {
		await saveThreadSnapshot(toOwnerKey, migratedSnapshot);
	}

	if (fromSnapshot) {
		await deleteThreadSnapshot(fromOwnerKey);
	}

	return migratedSnapshot;
};

export const resetThreadStoreStateForTests = () => {
	THREAD_SNAPSHOT_STORE.clear();
	warningLog.clear();
};
