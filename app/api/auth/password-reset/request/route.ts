import {
	applyResponseHeaders,
	consumeRateLimit,
	ensureAllowedOrigin,
	getClientIp,
	jsonError,
	pickMostConstrainedRateLimit,
} from "@/lib/server/api";
import {
	createIdentityResponseHeaders,
	resolveRequestIdentity,
} from "@/lib/server/auth";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/server/email";
import { requestPasswordResetCode } from "@/lib/server/password-reset-store";
import { validateProductionServerConfig } from "@/lib/server/production-config";

export const runtime = "nodejs";

const RESET_IP_RATE_LIMIT = {
	limit: 8,
	windowMs: 15 * 60 * 1_000,
} as const;
const RESET_EMAIL_RATE_LIMIT = {
	limit: 3,
	windowMs: 15 * 60 * 1_000,
} as const;

const getEmailFromBody = (body: unknown) => {
	if (!body || typeof body !== "object") {
		return "";
	}

	const email = (body as { email?: unknown }).email;
	return typeof email === "string" ? email.trim().toLowerCase() : "";
};

export async function POST(request: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(
			`[auth:password-reset:request:${requestId}] ${configCheck.logMessage}`,
		);
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
		console.error(
			`[auth:password-reset:request:${requestId}] ${identity.message}`,
		);
		return jsonError(500, "Authentication is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const body = await request.json().catch(() => null);
	const email = getEmailFromBody(body);
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return jsonError(400, "A valid email address is required.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const ipRateLimit = await consumeRateLimit({
		key: `auth:password-reset:ip:${getClientIp(request)}`,
		...RESET_IP_RATE_LIMIT,
	});
	const emailRateLimit = await consumeRateLimit({
		key: `auth:password-reset:email:${email}`,
		...RESET_EMAIL_RATE_LIMIT,
	});
	const activeRateLimit = pickMostConstrainedRateLimit(
		ipRateLimit,
		emailRateLimit,
	);

	if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
		const blockedRateLimit = ipRateLimit.allowed ? emailRateLimit : ipRateLimit;
		return jsonError(
			429,
			"Too many password reset requests. Please try again shortly.",
			{
				requestId,
				rateLimit: blockedRateLimit,
				headers: new Headers([
					...responseHeaders.entries(),
					["Retry-After", String(blockedRateLimit.retryAfterSeconds)],
				]),
			},
		);
	}

	const resetCode = await requestPasswordResetCode(email);
	let emailSent = false;

	if (resetCode) {
		try {
			emailSent = await sendPasswordResetEmail({
				email,
				code: resetCode,
			});
		} catch (error) {
			console.error(
				`[auth:password-reset:request:${requestId}] Failed to send reset email.`,
				error,
			);

			if (isEmailConfigured() && process.env.NODE_ENV === "production") {
				return jsonError(500, "Failed to send password reset email.", {
					requestId,
					rateLimit: activeRateLimit,
					headers: responseHeaders,
				});
			}
		}
	}

	return applyResponseHeaders(
		Response.json({
			emailSent,
			resetCode:
				emailSent && process.env.NODE_ENV === "production" ? null : resetCode,
			requestId,
		}),
		{
			requestId,
			rateLimit: activeRateLimit,
			headers: responseHeaders,
		},
	);
}
