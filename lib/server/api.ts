type RateLimitOptions = {
	key: string;
	limit: number;
	windowMs: number;
};

type UpstashPipelineResponse = {
	error?: string;
	result?: number | string | null;
};

export type RateLimitResult = {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: number;
	retryAfterSeconds: number;
};

type ResponseOptions = {
	requestId: string;
	rateLimit?: RateLimitResult;
	headers?: HeadersInit;
};

type RateLimitBucket = {
	count: number;
	resetAt: number;
};

export type AllowedOriginResult =
	| {
			allowed: true;
			origin: string;
	  }
	| {
			allowed: true;
			origin: null;
	  }
	| {
			allowed: false;
			message: string;
			origin: string | null;
	  };

const FORWARDED_IP_HEADERS = [
	"cf-connecting-ip",
	"x-forwarded-for",
	"x-real-ip",
	"fly-client-ip",
	"x-client-ip",
] as const;
const RATE_LIMIT_BUCKETS = new Map<string, RateLimitBucket>();
const MAX_TRACKED_BUCKETS = 5_000;
const warningLog = new Set<string>();

const cleanupExpiredBuckets = (now: number) => {
	if (RATE_LIMIT_BUCKETS.size < MAX_TRACKED_BUCKETS) {
		return;
	}

	for (const [key, bucket] of RATE_LIMIT_BUCKETS) {
		if (bucket.resetAt <= now) {
			RATE_LIMIT_BUCKETS.delete(key);
		}
	}
};

const warnOnce = (message: string, error?: unknown) => {
	if (warningLog.has(message)) {
		return;
	}

	warningLog.add(message);
	console.warn(message, error);
};

const normalizeOrigin = (value: string) => {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
};

const getOriginFromHeaders = (request: Request) => {
	const originHeader = request.headers.get("origin");
	const normalizedOrigin = originHeader ? normalizeOrigin(originHeader) : null;
	if (normalizedOrigin) {
		return normalizedOrigin;
	}

	const refererHeader = request.headers.get("referer");
	return refererHeader ? normalizeOrigin(refererHeader) : null;
};

const getAllowedOriginsFromEnvironment = () => {
	const configuredOrigins = process.env.ALLOWED_ORIGINS?.trim();
	if (!configuredOrigins) {
		return [];
	}

	return Array.from(
		new Set(
			configuredOrigins
				.split(/[,\n]/)
				.map((origin) => normalizeOrigin(origin.trim()))
				.filter((origin): origin is string => Boolean(origin)),
		),
	);
};

const consumeMemoryRateLimit = ({
	key,
	limit,
	windowMs,
}: RateLimitOptions): RateLimitResult => {
	const now = Date.now();
	cleanupExpiredBuckets(now);

	const currentBucket = RATE_LIMIT_BUCKETS.get(key);
	const bucket =
		currentBucket && currentBucket.resetAt > now
			? currentBucket
			: {
					count: 0,
					resetAt: now + windowMs,
				};

	if (bucket.count >= limit) {
		RATE_LIMIT_BUCKETS.set(key, bucket);

		return {
			allowed: false,
			limit,
			remaining: 0,
			resetAt: bucket.resetAt,
			retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
		};
	}

	bucket.count += 1;
	RATE_LIMIT_BUCKETS.set(key, bucket);

	return {
		allowed: true,
		limit,
		remaining: Math.max(0, limit - bucket.count),
		resetAt: bucket.resetAt,
		retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
	};
};

const consumeUpstashRateLimit = async ({
	key,
	limit,
	windowMs,
}: RateLimitOptions): Promise<RateLimitResult> => {
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token) {
		return consumeMemoryRateLimit({ key, limit, windowMs });
	}

	const namespacedKey = `rate_limit:${process.env.RATE_LIMIT_PREFIX?.trim() || "default"}:${key}`;
	const now = Date.now();
	const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify([
			["INCR", namespacedKey],
			["PEXPIRE", namespacedKey, String(windowMs), "NX"],
			["PTTL", namespacedKey],
		]),
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`Upstash returned ${response.status}.`);
	}

	const pipelineResults = (await response.json()) as UpstashPipelineResponse[];
	const [incrementResult, , ttlResult] = pipelineResults;

	if (incrementResult?.error || ttlResult?.error) {
		throw new Error(
			incrementResult?.error || ttlResult?.error || "Unknown error.",
		);
	}

	const count = Number(incrementResult?.result);
	const ttlMs = Number(ttlResult?.result);

	if (!Number.isFinite(count)) {
		throw new Error("Upstash rate-limit count was not numeric.");
	}

	const resetAt =
		now + (Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : windowMs);
	const allowed = count <= limit;

	return {
		allowed,
		limit,
		remaining: allowed ? Math.max(0, limit - count) : 0,
		resetAt,
		retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1_000)),
	};
};

export const getClientIp = (request: Request) => {
	for (const headerName of FORWARDED_IP_HEADERS) {
		const headerValue = request.headers.get(headerName);
		if (!headerValue) {
			continue;
		}

		const normalizedValue =
			headerName === "x-forwarded-for"
				? headerValue.split(",")[0]?.trim()
				: headerValue.trim();

		if (normalizedValue) {
			return normalizedValue.slice(0, 128);
		}
	}

	return "anonymous";
};

export const ensureAllowedOrigin = (request: Request): AllowedOriginResult => {
	const allowedOrigins = getAllowedOriginsFromEnvironment();
	if (allowedOrigins.length === 0) {
		return {
			allowed: true,
			origin: getOriginFromHeaders(request),
		};
	}

	const requestOrigin = getOriginFromHeaders(request);
	if (!requestOrigin) {
		return {
			allowed: false,
			message: "Missing Origin or Referer header.",
			origin: null,
		};
	}

	if (!allowedOrigins.includes(requestOrigin)) {
		return {
			allowed: false,
			message: "Origin is not allowed.",
			origin: requestOrigin,
		};
	}

	return {
		allowed: true,
		origin: requestOrigin,
	};
};

export const consumeRateLimit = async (
	options: RateLimitOptions,
): Promise<RateLimitResult> => {
	try {
		return await consumeUpstashRateLimit(options);
	} catch (error) {
		warnOnce(
			"Shared rate-limit backend failed. Falling back to in-memory rate limiting.",
			error,
		);
		return consumeMemoryRateLimit(options);
	}
};

export const applyResponseHeaders = (
	response: Response,
	{ requestId, rateLimit, headers }: ResponseOptions,
) => {
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("X-Request-Id", requestId);

	if (rateLimit) {
		response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
		response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
		response.headers.set(
			"X-RateLimit-Reset",
			String(Math.ceil(rateLimit.resetAt / 1_000)),
		);
	}

	if (headers) {
		const extraHeaders = new Headers(headers);

		for (const [key, value] of extraHeaders) {
			if (key.toLowerCase() === "set-cookie") {
				response.headers.append(key, value);
				continue;
			}

			response.headers.set(key, value);
		}
	}

	return response;
};

export const pickMostConstrainedRateLimit = (
	...results: RateLimitResult[]
): RateLimitResult => {
	if (results.length === 0) {
		throw new Error("At least one rate-limit result is required.");
	}

	return results.reduce((selected, candidate) => {
		if (selected.allowed !== candidate.allowed) {
			return selected.allowed ? candidate : selected;
		}

		if (candidate.remaining !== selected.remaining) {
			return candidate.remaining < selected.remaining ? candidate : selected;
		}

		return candidate.resetAt > selected.resetAt ? candidate : selected;
	});
};

export const jsonError = (
	status: number,
	error: string,
	options: ResponseOptions,
) =>
	applyResponseHeaders(
		Response.json(
			{
				error,
				requestId: options.requestId,
			},
			{ status },
		),
		options,
	);

export const resetRateLimitStateForTests = () => {
	RATE_LIMIT_BUCKETS.clear();
	warningLog.clear();
};
