import {
	applyResponseHeaders,
	consumeRateLimit,
	ensureAllowedOrigin,
	getClientIp,
	jsonError,
	pickMostConstrainedRateLimit,
} from "@/lib/server/api";
import { resolveRequestIdentity } from "@/lib/server/auth";
import { validateProductionServerConfig } from "@/lib/server/production-config";
import {
	deleteThreadSnapshot,
	loadThreadSnapshot,
	saveThreadSnapshot,
} from "@/lib/server/thread-store";
import { coercePersistedThreadSnapshot } from "@/lib/thread-persistence";

export const runtime = "nodejs";

const THREAD_SESSION_RATE_LIMIT = {
	limit: 180,
	windowMs: 10 * 60 * 1_000,
} as const;
const THREAD_IP_RATE_LIMIT = {
	limit: 360,
	windowMs: 10 * 60 * 1_000,
} as const;

const createResponseHeaders = (
	identity: Awaited<ReturnType<typeof resolveRequestIdentity>>,
) => {
	const headers = new Headers({
		Vary: "Origin, Referer, Cookie",
	});

	if (identity.ok) {
		for (const [key, value] of identity.headers.entries()) {
			headers.append(key, value);
		}
	}

	return headers;
};

const applyThreadGuards = async (request: Request, requestId: string) => {
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(`[thread:${requestId}] ${configCheck.logMessage}`);
		return {
			ok: false as const,
			response: jsonError(500, configCheck.clientMessage, { requestId }),
		};
	}

	const originCheck = ensureAllowedOrigin(request);
	const identity = await resolveRequestIdentity(request);
	const responseHeaders = createResponseHeaders(identity);

	if (!originCheck.allowed) {
		return {
			ok: false as const,
			response: jsonError(403, originCheck.message, {
				requestId,
				headers: responseHeaders,
			}),
		};
	}

	if (!identity.ok) {
		console.error(`[thread:${requestId}] ${identity.message}`);
		return {
			ok: false as const,
			response: jsonError(500, "Session protection is not configured.", {
				requestId,
				headers: responseHeaders,
			}),
		};
	}

	const ipRateLimit = await consumeRateLimit({
		key: `thread:ip:${getClientIp(request)}`,
		...THREAD_IP_RATE_LIMIT,
	});
	const sessionRateLimit = await consumeRateLimit({
		key: identity.session.user
			? `thread:user:${identity.session.user.id}`
			: `thread:session:${identity.sessionId}`,
		...THREAD_SESSION_RATE_LIMIT,
	});
	const activeRateLimit = pickMostConstrainedRateLimit(
		ipRateLimit,
		sessionRateLimit,
	);

	if (!ipRateLimit.allowed || !sessionRateLimit.allowed) {
		const blockedRateLimit = ipRateLimit.allowed
			? sessionRateLimit
			: ipRateLimit;
		return {
			ok: false as const,
			response: jsonError(
				429,
				"Too many thread sync requests. Please try again shortly.",
				{
					requestId,
					rateLimit: blockedRateLimit,
					headers: new Headers([
						...responseHeaders.entries(),
						["Retry-After", String(blockedRateLimit.retryAfterSeconds)],
					]),
				},
			),
		};
	}

	return {
		ok: true as const,
		threadOwnerKey: identity.threadOwnerKey,
		rateLimit: activeRateLimit,
		headers: responseHeaders,
	};
};

export async function GET(request: Request) {
	const requestId = crypto.randomUUID();
	const guard = await applyThreadGuards(request, requestId);
	if (!guard.ok) {
		return guard.response;
	}

	try {
		const snapshot = await loadThreadSnapshot(guard.threadOwnerKey);

		return applyResponseHeaders(
			Response.json({
				snapshot,
				requestId,
			}),
			{
				requestId,
				rateLimit: guard.rateLimit,
				headers: guard.headers,
			},
		);
	} catch (error) {
		console.error(
			`[thread:${requestId}] Failed to load thread snapshot.`,
			error,
		);
		return jsonError(500, "Failed to load saved conversation.", {
			requestId,
			rateLimit: guard.rateLimit,
			headers: guard.headers,
		});
	}
}

export async function PUT(request: Request) {
	const requestId = crypto.randomUUID();
	const guard = await applyThreadGuards(request, requestId);
	if (!guard.ok) {
		return guard.response;
	}

	try {
		const body = await request.json().catch(() => null);
		const rawSnapshot =
			body && typeof body === "object" && "snapshot" in body
				? (body as { snapshot?: unknown }).snapshot
				: null;
		const snapshot = coercePersistedThreadSnapshot(rawSnapshot);

		if (!snapshot) {
			return jsonError(400, "A valid thread snapshot is required.", {
				requestId,
				rateLimit: guard.rateLimit,
				headers: guard.headers,
			});
		}

		await saveThreadSnapshot(guard.threadOwnerKey, snapshot);

		return applyResponseHeaders(
			Response.json({
				ok: true,
				savedAt: snapshot.savedAt,
				requestId,
			}),
			{
				requestId,
				rateLimit: guard.rateLimit,
				headers: guard.headers,
			},
		);
	} catch (error) {
		console.error(
			`[thread:${requestId}] Failed to save thread snapshot.`,
			error,
		);
		return jsonError(500, "Failed to save conversation.", {
			requestId,
			rateLimit: guard.rateLimit,
			headers: guard.headers,
		});
	}
}

export async function DELETE(request: Request) {
	const requestId = crypto.randomUUID();
	const guard = await applyThreadGuards(request, requestId);
	if (!guard.ok) {
		return guard.response;
	}

	try {
		await deleteThreadSnapshot(guard.threadOwnerKey);

		return applyResponseHeaders(new Response(null, { status: 204 }), {
			requestId,
			rateLimit: guard.rateLimit,
			headers: guard.headers,
		});
	} catch (error) {
		console.error(
			`[thread:${requestId}] Failed to clear thread snapshot.`,
			error,
		);
		return jsonError(500, "Failed to clear conversation.", {
			requestId,
			rateLimit: guard.rateLimit,
			headers: guard.headers,
		});
	}
}
