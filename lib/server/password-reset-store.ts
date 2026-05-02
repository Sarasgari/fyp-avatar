import { createHash, createHmac, randomInt } from "node:crypto";
import { normalizeEmail } from "../auth";
import { getUserByEmail, updateUserPassword } from "./user-store";

type UpstashPipelineResponse = {
	error?: string;
	result?: number | string | null;
};

type PasswordResetRecord = {
	email: string;
	expiresAt: string;
};

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1_000;
const RESET_RECORDS_BY_HASH = new Map<string, PasswordResetRecord>();
const warningLog = new Set<string>();

const warnOnce = (message: string, error?: unknown) => {
	if (warningLog.has(message)) {
		return;
	}

	warningLog.add(message);
	console.warn(message, error);
};

const getPasswordResetPrefix = () =>
	process.env.PASSWORD_RESET_PREFIX?.trim() ||
	process.env.USER_STORE_PREFIX?.trim() ||
	process.env.RATE_LIMIT_PREFIX?.trim() ||
	"default";

const hasSharedResetStore = () =>
	Boolean(
		process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
	);

const getPasswordResetSecret = () =>
	process.env.PASSWORD_RESET_SECRET?.trim() ||
	process.env.AUTH_SIGNING_SECRET?.trim() ||
	process.env.SESSION_SIGNING_SECRET?.trim() ||
	"development-only-password-reset-secret";

const hashResetCode = (email: string, code: string) =>
	createHash("sha256")
		.update(`${normalizeEmail(email)}:${code.trim()}`)
		.digest("base64url");

const getPasswordResetKey = (hash: string) =>
	`password_reset:${getPasswordResetPrefix()}:${hash}`;

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

const createResetCode = () => String(randomInt(100_000, 1_000_000));

const getResetBucket = (now = Date.now()) =>
	Math.floor(now / PASSWORD_RESET_TTL_MS);

const createStatelessResetCode = (email: string, bucket = getResetBucket()) => {
	const digest = createHmac("sha256", getPasswordResetSecret())
		.update(`${normalizeEmail(email)}:${bucket}`)
		.digest();
	const value = digest.readUInt32BE(0) % 1_000_000;
	return value.toString().padStart(6, "0");
};

const isValidStatelessResetCode = (email: string, code: string) => {
	const currentBucket = getResetBucket();
	return [currentBucket, currentBucket - 1].some(
		(bucket) => createStatelessResetCode(email, bucket) === code.trim(),
	);
};

const storeMemoryResetCode = (hash: string, record: PasswordResetRecord) => {
	RESET_RECORDS_BY_HASH.set(hash, record);
};

const storeResetCode = async (hash: string, record: PasswordResetRecord) => {
	const pipelineResult = await runUpstashPipeline([
		[
			"SET",
			getPasswordResetKey(hash),
			JSON.stringify(record),
			"PX",
			String(PASSWORD_RESET_TTL_MS),
		],
	]);

	if (!pipelineResult) {
		storeMemoryResetCode(hash, record);
		return;
	}

	if (pipelineResult[0]?.error) {
		throw new Error(pipelineResult[0].error);
	}
};

const consumeMemoryResetCode = (hash: string) => {
	const record = RESET_RECORDS_BY_HASH.get(hash);
	RESET_RECORDS_BY_HASH.delete(hash);

	if (!record || Date.parse(record.expiresAt) <= Date.now()) {
		return null;
	}

	return record;
};

const consumeResetCode = async (hash: string) => {
	const key = getPasswordResetKey(hash);
	const pipelineResult = await runUpstashPipeline([
		["GET", key],
		["DEL", key],
	]);

	if (!pipelineResult) {
		return consumeMemoryResetCode(hash);
	}

	const rawRecord = pipelineResult[0];
	if (rawRecord?.error || pipelineResult[1]?.error) {
		throw new Error(
			rawRecord?.error || pipelineResult[1]?.error || "Reset lookup failed.",
		);
	}

	if (typeof rawRecord?.result !== "string") {
		return null;
	}

	const record = JSON.parse(rawRecord.result) as PasswordResetRecord;
	if (Date.parse(record.expiresAt) <= Date.now()) {
		return null;
	}

	return record;
};

export const requestPasswordResetCode = async (email: string) => {
	const normalizedEmail = normalizeEmail(email);
	const user = await getUserByEmail(normalizedEmail);
	if (!user) {
		return null;
	}

	if (!hasSharedResetStore()) {
		return createStatelessResetCode(normalizedEmail);
	}

	const code = createResetCode();
	const hash = hashResetCode(normalizedEmail, code);
	await storeResetCode(hash, {
		email: normalizedEmail,
		expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
	});
	return code;
};

export const resetPasswordWithCode = async ({
	code,
	email,
	password,
}: {
	code: string;
	email: string;
	password: string;
}) => {
	const normalizedEmail = normalizeEmail(email);
	const hash = hashResetCode(normalizedEmail, code);

	try {
		if (!hasSharedResetStore()) {
			if (!isValidStatelessResetCode(normalizedEmail, code)) {
				return null;
			}

			return updateUserPassword({
				email: normalizedEmail,
				password,
			});
		}

		const record = await consumeResetCode(hash);
		if (!record || record.email !== normalizedEmail) {
			return null;
		}

		return updateUserPassword({
			email: normalizedEmail,
			password,
		});
	} catch (error) {
		warnOnce(
			"Shared password reset backend failed. Falling back to in-memory password reset storage.",
			error,
		);
		const record = consumeMemoryResetCode(hash);
		if (!record || record.email !== normalizedEmail) {
			return null;
		}

		return updateUserPassword({
			email: normalizedEmail,
			password,
		});
	}
};

export const resetPasswordResetStoreStateForTests = () => {
	RESET_RECORDS_BY_HASH.clear();
	warningLog.clear();
};
