import {
	applyResponseHeaders,
	consumeRateLimit,
	ensureAllowedOrigin,
	getClientIp,
	jsonError,
} from "@/lib/server/api";
import {
	createIdentityResponseHeaders,
	isAdminUser,
	resolveRequestIdentity,
} from "@/lib/server/auth";
import { resetPasswordWithCode } from "@/lib/server/password-reset-store";
import { validateProductionServerConfig } from "@/lib/server/production-config";

export const runtime = "nodejs";

const CONFIRM_RATE_LIMIT = {
	limit: 8,
	windowMs: 15 * 60 * 1_000,
} as const;

const getResetPayload = (body: unknown) => {
	if (!body || typeof body !== "object") {
		return {
			email: "",
			code: "",
			password: "",
		};
	}

	const payload = body as {
		code?: unknown;
		email?: unknown;
		password?: unknown;
	};

	return {
		email:
			typeof payload.email === "string"
				? payload.email.trim().toLowerCase()
				: "",
		code: typeof payload.code === "string" ? payload.code.trim() : "",
		password: typeof payload.password === "string" ? payload.password : "",
	};
};

export async function POST(request: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(
			`[auth:password-reset:confirm:${requestId}] ${configCheck.logMessage}`,
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
			`[auth:password-reset:confirm:${requestId}] ${identity.message}`,
		);
		return jsonError(500, "Authentication is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const body = await request.json().catch(() => null);
	const payload = getResetPayload(body);
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
		return jsonError(400, "A valid email address is required.", {
			requestId,
			headers: responseHeaders,
		});
	}

	if (!/^\d{6}$/.test(payload.code)) {
		return jsonError(400, "A valid 6-digit reset code is required.", {
			requestId,
			headers: responseHeaders,
		});
	}

	if (payload.password.length < 8 || payload.password.length > 128) {
		return jsonError(400, "Passwords must be between 8 and 128 characters.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const rateLimit = await consumeRateLimit({
		key: `auth:password-reset:confirm:${getClientIp(request)}`,
		...CONFIRM_RATE_LIMIT,
	});
	if (!rateLimit.allowed) {
		return jsonError(
			429,
			"Too many password reset attempts. Please try again shortly.",
			{
				requestId,
				rateLimit,
				headers: new Headers([
					...responseHeaders.entries(),
					["Retry-After", String(rateLimit.retryAfterSeconds)],
				]),
			},
		);
	}

	const user = await resetPasswordWithCode(payload);
	if (!user) {
		return jsonError(400, "Reset code is invalid or expired.", {
			requestId,
			rateLimit,
			headers: responseHeaders,
		});
	}

	return applyResponseHeaders(
		Response.json({
			user,
			isAuthenticated: false,
			isAdmin: isAdminUser(user),
			requestId,
		}),
		{
			requestId,
			rateLimit,
			headers: responseHeaders,
		},
	);
}
