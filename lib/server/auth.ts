import { createHmac, timingSafeEqual } from "node:crypto";
import {
	type AuthenticatedUser,
	type AuthSessionState,
	getThreadOwnerKeyForIdentity,
	normalizeEmail,
} from "../auth";
import { resolveSession, type SessionResolution } from "./session";
import { getUserById } from "./user-store";

const AUTH_COOKIE_NAME = "avatar_auth";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const AUTH_COOKIE_VERSION = "v1";
const USER_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVELOPMENT_AUTH_SECRET = "development-only-avatar-auth-secret";

type SigningSecretResult =
	| {
			ok: true;
			secret: string;
	  }
	| {
			ok: false;
			message: string;
	  };

type AuthCookieResolution = {
	user: AuthenticatedUser | null;
	setCookieHeader?: string;
};

export type RequestIdentity =
	| {
			ok: true;
			sessionId: string;
			user: AuthenticatedUser | null;
			threadOwnerKey: string;
			headers: Headers;
			session: AuthSessionState;
	  }
	| {
			ok: false;
			message: string;
			headers: Headers;
	  };

export const createIdentityResponseHeaders = (identity: RequestIdentity) => {
	const headers = new Headers({
		Vary: "Origin, Referer, Cookie",
	});

	for (const [key, value] of identity.headers.entries()) {
		headers.append(key, value);
	}

	return headers;
};

const getAuthCookieName = () =>
	process.env.AUTH_COOKIE_NAME?.trim() || AUTH_COOKIE_NAME;

const getAuthCookieMaxAgeSeconds = () => {
	const rawValue = process.env.AUTH_COOKIE_MAX_AGE_SECONDS?.trim();
	if (!rawValue) {
		return AUTH_COOKIE_MAX_AGE_SECONDS;
	}

	const parsedValue = Number(rawValue);
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return AUTH_COOKIE_MAX_AGE_SECONDS;
	}

	return Math.floor(parsedValue);
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

const getAuthSigningSecret = (): SigningSecretResult => {
	const configuredSecret =
		process.env.AUTH_SIGNING_SECRET?.trim() ||
		process.env.SESSION_SIGNING_SECRET?.trim();
	if (configuredSecret) {
		return {
			ok: true,
			secret: configuredSecret,
		};
	}

	if (process.env.NODE_ENV === "production") {
		return {
			ok: false,
			message:
				"AUTH_SIGNING_SECRET or SESSION_SIGNING_SECRET must be configured in production.",
		};
	}

	return {
		ok: true,
		secret: DEVELOPMENT_AUTH_SECRET,
	};
};

const signUserId = (userId: string, secret: string) =>
	createHmac("sha256", secret).update(userId).digest("base64url");

const serializeAuthCookie = (
	userId: string,
	secret: string,
	maxAge: number,
) => {
	const cookieValue = `${AUTH_COOKIE_VERSION}.${userId}.${signUserId(
		userId,
		secret,
	)}`;
	const attributes = [
		`${getAuthCookieName()}=${cookieValue}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${maxAge}`,
	];

	if (process.env.NODE_ENV === "production") {
		attributes.push("Secure");
	}

	return attributes.join("; ");
};

const parseAuthenticatedUserId = (cookieValue: string, secret: string) => {
	const [version, userId, signature, ...rest] = cookieValue.split(".");
	if (
		version !== AUTH_COOKIE_VERSION ||
		!userId ||
		!signature ||
		rest.length > 0
	) {
		return null;
	}

	if (!USER_ID_PATTERN.test(userId)) {
		return null;
	}

	const expectedSignature = signUserId(userId, secret);
	const actualBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expectedSignature);

	if (actualBuffer.length !== expectedBuffer.length) {
		return null;
	}

	return timingSafeEqual(actualBuffer, expectedBuffer) ? userId : null;
};

export const createAuthCookie = (userId: string) => {
	const secretResult = getAuthSigningSecret();
	if (!secretResult.ok) {
		throw new Error(secretResult.message);
	}

	return serializeAuthCookie(
		userId,
		secretResult.secret,
		getAuthCookieMaxAgeSeconds(),
	);
};

export const createClearedAuthCookie = () => {
	const secretResult = getAuthSigningSecret();
	if (!secretResult.ok) {
		throw new Error(secretResult.message);
	}

	return serializeAuthCookie(crypto.randomUUID(), secretResult.secret, 0);
};

const resolveAuthCookie = async (
	request: Request,
): Promise<AuthCookieResolution> => {
	const secretResult = getAuthSigningSecret();
	if (!secretResult.ok) {
		throw new Error(secretResult.message);
	}

	const rawCookie = parseCookies(request).get(getAuthCookieName());
	if (!rawCookie) {
		return {
			user: null,
		};
	}

	const userId = parseAuthenticatedUserId(rawCookie, secretResult.secret);
	if (!userId) {
		return {
			user: null,
			setCookieHeader: createClearedAuthCookie(),
		};
	}

	const user = await getUserById(userId);
	if (!user) {
		return {
			user: null,
			setCookieHeader: createClearedAuthCookie(),
		};
	}

	return {
		user,
	};
};

const buildIdentityHeaders = ({
	session,
	authCookie,
}: {
	session: SessionResolution;
	authCookie: AuthCookieResolution;
}) => {
	const headers = new Headers();

	if (session.ok && session.setCookieHeader) {
		headers.append("Set-Cookie", session.setCookieHeader);
	}

	if (authCookie.setCookieHeader) {
		headers.append("Set-Cookie", authCookie.setCookieHeader);
	}

	return headers;
};

export const resolveRequestIdentity = async (
	request: Request,
): Promise<RequestIdentity> => {
	const session = resolveSession(request);
	if (!session.ok) {
		return {
			ok: false,
			message: session.message,
			headers: new Headers(),
		};
	}

	const authCookie = await resolveAuthCookie(request);
	const headers = buildIdentityHeaders({ session, authCookie });
	const user = authCookie.user;

	return {
		ok: true,
		sessionId: session.sessionId,
		user,
		threadOwnerKey: getThreadOwnerKeyForIdentity({
			sessionId: session.sessionId,
			userId: user?.id,
		}),
		headers,
		session: {
			user,
			isAuthenticated: Boolean(user),
			threadOwnerKey: getThreadOwnerKeyForIdentity({
				sessionId: session.sessionId,
				userId: user?.id,
			}),
		},
	};
};

export const getValidatedCredentials = (body: unknown) => {
	if (!body || typeof body !== "object") {
		return {
			ok: false as const,
			message: "Request body must be a JSON object.",
		};
	}

	const email =
		typeof (body as { email?: unknown }).email === "string"
			? normalizeEmail((body as { email: string }).email)
			: "";
	const password =
		typeof (body as { password?: unknown }).password === "string"
			? (body as { password: string }).password
			: "";

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return {
			ok: false as const,
			message: "A valid email address is required.",
		};
	}

	if (password.length < 8 || password.length > 128) {
		return {
			ok: false as const,
			message: "Passwords must be between 8 and 128 characters.",
		};
	}

	return {
		ok: true as const,
		value: {
			email,
			password,
		},
	};
};
