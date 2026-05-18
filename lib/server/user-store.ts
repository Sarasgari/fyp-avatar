import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	type AuthenticatedUser,
	normalizeDisplayName,
	normalizeEmail,
} from "../auth";

type UpstashPipelineResponse = {
	error?: string;
	result?: number | string | null;
};

type StoredUserRecord = AuthenticatedUser & {
	passwordHash: string;
};

type FileUserStoreState = {
	usersById: Record<string, StoredUserRecord>;
	userIdsByEmail: Record<string, string>;
};

const USER_STORE_BY_ID = new Map<string, StoredUserRecord>();
const USER_IDS_BY_EMAIL = new Map<string, string>();
const warningLog = new Set<string>();
let fileUserStoreTask: Promise<void> = Promise.resolve();

const warnOnce = (message: string, error?: unknown) => {
	if (warningLog.has(message)) {
		return;
	}

	warningLog.add(message);
	console.warn(message, error);
};

const getUserStorePrefix = () =>
	process.env.USER_STORE_PREFIX?.trim() ||
	process.env.THREAD_STORE_PREFIX?.trim() ||
	process.env.RATE_LIMIT_PREFIX?.trim() ||
	"default";

const getUserRecordKey = (userId: string) =>
	`user_store:${getUserStorePrefix()}:user:${userId}`;

const getUserEmailKey = (email: string) =>
	`user_store:${getUserStorePrefix()}:email:${normalizeEmail(email)}`;

const getUserStoreFilePath = () =>
	process.env.USER_STORE_FILE_PATH?.trim() || "";

const hasFileUserStore = () => getUserStoreFilePath().length > 0;

const withFileUserStoreLock = async <T>(work: () => Promise<T>) => {
	const nextTask = fileUserStoreTask.catch(() => undefined).then(work);
	fileUserStoreTask = nextTask.then(
		() => undefined,
		() => undefined,
	);
	return nextTask;
};

const readFileUserStore = async (): Promise<FileUserStoreState> => {
	const filePath = getUserStoreFilePath();

	if (!filePath) {
		return {
			usersById: {},
			userIdsByEmail: {},
		};
	}

	try {
		const rawState = await readFile(filePath, "utf8");
		const parsedState = JSON.parse(rawState) as unknown;

		if (!parsedState || typeof parsedState !== "object") {
			return {
				usersById: {},
				userIdsByEmail: {},
			};
		}

		const candidate = parsedState as Partial<FileUserStoreState>;

		return {
			usersById:
				candidate.usersById && typeof candidate.usersById === "object"
					? Object.fromEntries(
							Object.entries(candidate.usersById).flatMap(([id, record]) => {
								const parsedRecord = parseStoredUserRecord(record);
								return parsedRecord ? [[id, parsedRecord]] : [];
							}),
						)
					: {},
			userIdsByEmail:
				candidate.userIdsByEmail && typeof candidate.userIdsByEmail === "object"
					? Object.fromEntries(
							Object.entries(candidate.userIdsByEmail).filter(
								([, userId]) => typeof userId === "string",
							),
						)
					: {},
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {
				usersById: {},
				userIdsByEmail: {},
			};
		}

		throw error;
	}
};

const writeFileUserStore = async (state: FileUserStoreState) => {
	const filePath = getUserStoreFilePath();
	if (!filePath) {
		return;
	}

	await mkdir(dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
	await writeFile(tempPath, JSON.stringify(state), "utf8");
	await rename(tempPath, filePath);
};

const hashPassword = (password: string) => {
	const salt = randomBytes(16).toString("base64url");
	const hash = scryptSync(password, salt, 64).toString("base64url");
	return `${salt}:${hash}`;
};

const verifyPassword = (password: string, passwordHash: string) => {
	const [salt, expectedHash] = passwordHash.split(":");
	if (!salt || !expectedHash) {
		return false;
	}

	const actualHash = scryptSync(password, salt, 64).toString("base64url");
	const actualBuffer = Buffer.from(actualHash);
	const expectedBuffer = Buffer.from(expectedHash);

	if (actualBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(actualBuffer, expectedBuffer);
};

const parseStoredUserRecord = (value: unknown): StoredUserRecord | null => {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Partial<StoredUserRecord>;
	if (
		typeof record.id !== "string" ||
		typeof record.email !== "string" ||
		typeof record.createdAt !== "string" ||
		typeof record.passwordHash !== "string"
	) {
		return null;
	}

	const fallbackName =
		record.email.split("@")[0]?.replace(/[._-]+/g, " ") || "Signed in user";
	const name =
		typeof record.name === "string" && normalizeDisplayName(record.name)
			? normalizeDisplayName(record.name)
			: normalizeDisplayName(fallbackName);

	return {
		id: record.id,
		email: record.email,
		name,
		createdAt: record.createdAt,
		passwordHash: record.passwordHash,
	};
};

const toAuthenticatedUser = (
	record: StoredUserRecord | null,
): AuthenticatedUser | null =>
	record
		? {
				id: record.id,
				email: record.email,
				name: record.name,
				createdAt: record.createdAt,
			}
		: null;

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

const loadMemoryUserById = (userId: string) =>
	USER_STORE_BY_ID.get(userId) ?? null;

const loadMemoryUserByEmail = (email: string) => {
	const userId = USER_IDS_BY_EMAIL.get(normalizeEmail(email));
	return userId ? loadMemoryUserById(userId) : null;
};

const loadFileUserById = async (userId: string) => {
	return withFileUserStoreLock(async () => {
		const state = await readFileUserStore();
		return state.usersById[userId] ?? null;
	});
};

const loadFileUserByEmail = async (email: string) => {
	return withFileUserStoreLock(async () => {
		const state = await readFileUserStore();
		const userId = state.userIdsByEmail[normalizeEmail(email)];
		return userId ? (state.usersById[userId] ?? null) : null;
	});
};

const createMemoryUser = ({
	email,
	name,
	password,
}: {
	email: string;
	name: string;
	password: string;
}) => {
	const normalizedEmail = normalizeEmail(email);
	if (USER_IDS_BY_EMAIL.has(normalizedEmail)) {
		return null;
	}

	const record: StoredUserRecord = {
		id: crypto.randomUUID(),
		email: normalizedEmail,
		name: normalizeDisplayName(name),
		createdAt: new Date().toISOString(),
		passwordHash: hashPassword(password),
	};

	USER_STORE_BY_ID.set(record.id, record);
	USER_IDS_BY_EMAIL.set(normalizedEmail, record.id);
	return toAuthenticatedUser(record);
};

const createFileUser = async ({
	email,
	name,
	password,
}: {
	email: string;
	name: string;
	password: string;
}) => {
	return withFileUserStoreLock(async () => {
		const normalizedEmail = normalizeEmail(email);
		const state = await readFileUserStore();
		if (state.userIdsByEmail[normalizedEmail]) {
			return null;
		}

		const record: StoredUserRecord = {
			id: crypto.randomUUID(),
			email: normalizedEmail,
			name: normalizeDisplayName(name),
			createdAt: new Date().toISOString(),
			passwordHash: hashPassword(password),
		};

		state.usersById[record.id] = record;
		state.userIdsByEmail[normalizedEmail] = record.id;
		await writeFileUserStore(state);
		return toAuthenticatedUser(record);
	});
};

const loadUpstashUserById = async (userId: string) => {
	const pipelineResult = await runUpstashPipeline([
		["GET", getUserRecordKey(userId)],
	]);
	if (!pipelineResult) {
		return loadMemoryUserById(userId);
	}

	const rawUser = pipelineResult[0];
	if (rawUser?.error) {
		throw new Error(rawUser.error);
	}

	if (typeof rawUser?.result !== "string") {
		return null;
	}

	return parseStoredUserRecord(JSON.parse(rawUser.result) as unknown);
};

const loadUpstashUserByEmail = async (email: string) => {
	const pipelineResult = await runUpstashPipeline([
		["GET", getUserEmailKey(email)],
	]);
	if (!pipelineResult) {
		return loadMemoryUserByEmail(email);
	}

	const rawUserId = pipelineResult[0];
	if (rawUserId?.error) {
		throw new Error(rawUserId.error);
	}

	if (typeof rawUserId?.result !== "string") {
		return null;
	}

	return loadUpstashUserById(rawUserId.result);
};

const createUpstashUser = async ({
	email,
	name,
	password,
}: {
	email: string;
	name: string;
	password: string;
}) => {
	const normalizedEmail = normalizeEmail(email);
	const existingUser = await loadUpstashUserByEmail(normalizedEmail);
	if (existingUser) {
		return null;
	}

	const record: StoredUserRecord = {
		id: crypto.randomUUID(),
		email: normalizedEmail,
		name: normalizeDisplayName(name),
		createdAt: new Date().toISOString(),
		passwordHash: hashPassword(password),
	};
	const pipelineResult = await runUpstashPipeline([
		["SET", getUserEmailKey(normalizedEmail), record.id, "NX"],
		["SET", getUserRecordKey(record.id), JSON.stringify(record)],
	]);
	if (!pipelineResult) {
		return createMemoryUser({ email: normalizedEmail, name, password });
	}

	if (pipelineResult[0]?.error || pipelineResult[1]?.error) {
		throw new Error(
			pipelineResult[0]?.error ||
				pipelineResult[1]?.error ||
				"Failed to store the user record.",
		);
	}

	if (pipelineResult[0]?.result !== "OK") {
		return null;
	}

	return toAuthenticatedUser(record);
};

export const createUser = async ({
	email,
	name,
	password,
}: {
	email: string;
	name: string;
	password: string;
}) => {
	try {
		if (hasFileUserStore()) {
			return await createFileUser({ email, name, password });
		}

		return await createUpstashUser({ email, name, password });
	} catch (error) {
		warnOnce(
			"Shared user storage backend failed. Falling back to in-memory user storage.",
			error,
		);
		return createMemoryUser({ email, name, password });
	}
};

export const getUserById = async (userId: string) => {
	try {
		if (hasFileUserStore()) {
			return toAuthenticatedUser(await loadFileUserById(userId));
		}

		return toAuthenticatedUser(await loadUpstashUserById(userId));
	} catch (error) {
		warnOnce(
			"Shared user storage backend failed. Falling back to in-memory user storage.",
			error,
		);
		return toAuthenticatedUser(loadMemoryUserById(userId));
	}
};

export const authenticateUser = async ({
	email,
	password,
}: {
	email: string;
	password: string;
}) => {
	try {
		if (hasFileUserStore()) {
			const record = await loadFileUserByEmail(email);
			return record && verifyPassword(password, record.passwordHash)
				? toAuthenticatedUser(record)
				: null;
		}

		const record = await loadUpstashUserByEmail(email);
		return record && verifyPassword(password, record.passwordHash)
			? toAuthenticatedUser(record)
			: null;
	} catch (error) {
		warnOnce(
			"Shared user storage backend failed. Falling back to in-memory user storage.",
			error,
		);
		const record = loadMemoryUserByEmail(email);
		return record && verifyPassword(password, record.passwordHash)
			? toAuthenticatedUser(record)
			: null;
	}
};

export const resetUserStoreStateForTests = () => {
	USER_STORE_BY_ID.clear();
	USER_IDS_BY_EMAIL.clear();
	warningLog.clear();
};
