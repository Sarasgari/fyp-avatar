import { getGuestThreadOwnerKey, getUserThreadOwnerKey } from "@/lib/auth";
import {
	applyResponseHeaders,
	consumeRateLimit,
	ensureAllowedOrigin,
	getClientIp,
	jsonError,
	pickMostConstrainedRateLimit,
} from "@/lib/server/api";
import {
	createAuthCookie,
	createIdentityResponseHeaders,
	getValidatedRegistrationCredentials,
	isAdminUser,
	resolveRequestIdentity,
} from "@/lib/server/auth";
import { validateProductionServerConfig } from "@/lib/server/production-config";
import { migrateThreadSnapshot } from "@/lib/server/thread-store";
import { createUser } from "@/lib/server/user-store";

export const runtime = "nodejs";

const AUTH_SUBJECT_RATE_LIMIT = {
	limit: 6,
	windowMs: 10 * 60 * 1_000,
} as const;
const AUTH_IP_RATE_LIMIT = {
	limit: 12,
	windowMs: 10 * 60 * 1_000,
} as const;
const AUTH_EMAIL_RATE_LIMIT = {
	limit: 4,
	windowMs: 10 * 60 * 1_000,
} as const;

export async function POST(request: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(`[auth:register:${requestId}] ${configCheck.logMessage}`);
		return jsonError(500, configCheck.clientMessage, { requestId });
	}

	const originCheck = ensureAllowedOrigin(request);
	const identity = await resolveRequestIdentity(request);
	const responseHeaders = createIdentityResponseHeaders(identity);

	if (!originCheck.allowed) {
		return jsonError(403, originCheck.message, {
			requestId,
			headers: responseHeaders,
		});
	}

	if (!identity.ok) {
		console.error(`[auth:register:${requestId}] ${identity.message}`);
		return jsonError(500, "Authentication is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const body = await request.json().catch(() => null);
	const credentials = getValidatedRegistrationCredentials(body);
	if (!credentials.ok) {
		return jsonError(400, credentials.message, {
			requestId,
			headers: responseHeaders,
		});
	}

	const ipRateLimit = await consumeRateLimit({
		key: `auth:register:ip:${getClientIp(request)}`,
		...AUTH_IP_RATE_LIMIT,
	});
	const subjectRateLimit = await consumeRateLimit({
		key: identity.session.user
			? `auth:register:user:${identity.session.user.id}`
			: `auth:register:session:${identity.sessionId}`,
		...AUTH_SUBJECT_RATE_LIMIT,
	});
	const emailRateLimit = await consumeRateLimit({
		key: `auth:register:email:${credentials.value.email}`,
		...AUTH_EMAIL_RATE_LIMIT,
	});
	const activeRateLimit = pickMostConstrainedRateLimit(
		ipRateLimit,
		subjectRateLimit,
		emailRateLimit,
	);

	if (
		!ipRateLimit.allowed ||
		!subjectRateLimit.allowed ||
		!emailRateLimit.allowed
	) {
		const blockedRateLimit = [
			ipRateLimit,
			subjectRateLimit,
			emailRateLimit,
		].find((result) => !result.allowed);

		return jsonError(
			429,
			"Too many account creation attempts. Please try again shortly.",
			{
				requestId,
				rateLimit: blockedRateLimit ?? activeRateLimit,
				headers: new Headers([
					...responseHeaders.entries(),
					[
						"Retry-After",
						String((blockedRateLimit ?? activeRateLimit).retryAfterSeconds),
					],
				]),
			},
		);
	}

	const user = await createUser(credentials.value);
	if (!user) {
		return jsonError(409, "An account with that email already exists.", {
			requestId,
			rateLimit: activeRateLimit,
			headers: responseHeaders,
		});
	}

	await migrateThreadSnapshot({
		fromOwnerKey: getGuestThreadOwnerKey(identity.sessionId),
		toOwnerKey: getUserThreadOwnerKey(user.id),
	});

	const headers = new Headers(responseHeaders);
	headers.append("Set-Cookie", createAuthCookie(user.id));

	return applyResponseHeaders(
		Response.json({
			user,
			isAuthenticated: true,
			isAdmin: isAdminUser(user),
			threadOwnerKey: getUserThreadOwnerKey(user.id),
			requestId,
		}),
		{
			requestId,
			rateLimit: activeRateLimit,
			headers,
		},
	);
}
