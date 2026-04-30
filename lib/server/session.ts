import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_SESSION_COOKIE_NAME = "avatar_session";
const DEFAULT_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEVELOPMENT_SESSION_SECRET = "development-only-avatar-session-secret";
const SESSION_COOKIE_VERSION = "v1";
const SESSION_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const warningLog = new Set<string>();

type SessionSecretResult =
	| {
			ok: true;
			secret: string;
	  }
	| {
			ok: false;
			message: string;
	  };

export type SessionResolution =
	| {
			ok: true;
			sessionId: string;
			setCookieHeader?: string;
	  }
	| {
			ok: false;
			message: string;
	  };

const warnOnce = (message: string) => {
	if (warningLog.has(message)) {
		return;
	}

	warningLog.add(message);
	console.warn(message);
};

const getSessionCookieName = () =>
	process.env.SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME;

const getSessionCookieMaxAgeSeconds = () => {
	const rawValue = process.env.SESSION_COOKIE_MAX_AGE_SECONDS?.trim();
	if (!rawValue) {
		return DEFAULT_SESSION_COOKIE_MAX_AGE_SECONDS;
	}

	const parsedValue = Number(rawValue);
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return DEFAULT_SESSION_COOKIE_MAX_AGE_SECONDS;
	}

	return Math.floor(parsedValue);
};

const getSessionSigningSecret = (): SessionSecretResult => {
	const configuredSecret = process.env.SESSION_SIGNING_SECRET?.trim();
	if (configuredSecret) {
		return {
			ok: true,
			secret: configuredSecret,
		};
	}

	if (process.env.NODE_ENV === "production") {
		return {
			ok: false,
			message: "SESSION_SIGNING_SECRET must be configured in production.",
		};
	}

	warnOnce(
		"SESSION_SIGNING_SECRET is not configured. Falling back to an insecure development session secret.",
	);

	return {
		ok: true,
		secret: DEVELOPMENT_SESSION_SECRET,
	};
};

const parseCookies = (request: Request) => {
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) {
		return new Map<string, string>();
	}

	return new Map(
		cookieHeader
			.split(";")
			.map((chunk) => chunk.trim())
			.filter(Boolean)
			.map((chunk) => {
				const separatorIndex = chunk.indexOf("=");
				if (separatorIndex === -1) {
					return [chunk, ""];
				}

				return [
					chunk.slice(0, separatorIndex).trim(),
					chunk.slice(separatorIndex + 1).trim(),
				];
			}),
	);
};

const signSessionId = (sessionId: string, secret: string) =>
	createHmac("sha256", secret).update(sessionId).digest("base64url");

const serializeSessionCookie = (sessionId: string, secret: string) => {
	const cookieValue = `${SESSION_COOKIE_VERSION}.${sessionId}.${signSessionId(
		sessionId,
		secret,
	)}`;
	const attributes = [
		`${getSessionCookieName()}=${cookieValue}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${getSessionCookieMaxAgeSeconds()}`,
	];

	if (process.env.NODE_ENV === "production") {
		attributes.push("Secure");
	}

	return attributes.join("; ");
};

const isValidSignedSession = (value: string, secret: string) => {
	const [version, sessionId, signature, ...rest] = value.split(".");
	if (
		version !== SESSION_COOKIE_VERSION ||
		!sessionId ||
		!signature ||
		rest.length > 0
	) {
		return null;
	}

	if (!SESSION_ID_PATTERN.test(sessionId)) {
		return null;
	}

	const expectedSignature = signSessionId(sessionId, secret);
	const actualSignatureBuffer = Buffer.from(signature);
	const expectedSignatureBuffer = Buffer.from(expectedSignature);

	if (actualSignatureBuffer.length !== expectedSignatureBuffer.length) {
		return null;
	}

	return timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer)
		? sessionId
		: null;
};

export const resolveSession = (request: Request): SessionResolution => {
	const secretResult = getSessionSigningSecret();
	if (!secretResult.ok) {
		return secretResult;
	}

	const secret = secretResult.secret;
	const existingValue = parseCookies(request).get(getSessionCookieName());
	if (existingValue) {
		const sessionId = isValidSignedSession(existingValue, secret);
		if (sessionId) {
			return {
				ok: true,
				sessionId,
			};
		}
	}

	const sessionId = crypto.randomUUID();

	return {
		ok: true,
		sessionId,
		setCookieHeader: serializeSessionCookie(sessionId, secret),
	};
};

export const resetSessionStateForTests = () => {
	warningLog.clear();
};
