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
	getValidatedCredentials,
	resolveRequestIdentity,
} from "@/lib/server/auth";
import { validateProductionServerConfig } from "@/lib/server/production-config";
import { migrateThreadSnapshot } from "@/lib/server/thread-store";
import { authenticateUser } from "@/lib/server/user-store";

export const runtime = "nodejs";

const AUTH_SUBJECT_RATE_LIMIT = {
	limit: 10,
	windowMs: 10 * 60 * 1_000,
} as const;
const AUTH_IP_RATE_LIMIT = {
	limit: 20,
	windowMs: 10 * 60 * 1_000,
} as const;
const AUTH_EMAIL_RATE_LIMIT = {
	limit: 8,
	windowMs: 10 * 60 * 1_000,
} as const;

export async function POST(request: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(`[auth:login:${requestId}] ${configCheck.logMessage}`);
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
		console.error(`[auth:login:${requestId}] ${identity.message}`);
		return jsonError(500, "Authentication is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const body = await request.json().catch(() => null);
	const credentials = getValidatedCredentials(body);
	if (!credentials.ok) {
		return jsonError(400, credentials.message, {
			requestId,
			headers: responseHeaders,
		});
	}

	const ipRateLimit = await consumeRateLimit({
		key: `auth:login:ip:${getClientIp(request)}`,
		...AUTH_IP_RATE_LIMIT,
	});
	const subjectRateLimit = await consumeRateLimit({
		key: identity.session.user
			? `auth:login:user:${identity.session.user.id}`
			: `auth:login:session:${identity.sessionId}`,
		...AUTH_SUBJECT_RATE_LIMIT,
	});
	const emailRateLimit = await consumeRateLimit({
		key: `auth:login:email:${credentials.value.email}`,
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
			"Too many sign-in attempts. Please try again shortly.",
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

	const user = await authenticateUser(credentials.value);
	if (!user) {
		return jsonError(401, "Email or password is incorrect.", {
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
