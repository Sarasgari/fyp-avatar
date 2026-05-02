import { getGuestThreadOwnerKey } from "@/lib/auth";
import {
	applyResponseHeaders,
	ensureAllowedOrigin,
	jsonError,
} from "@/lib/server/api";
import {
	createClearedAuthCookie,
	createIdentityResponseHeaders,
	resolveRequestIdentity,
} from "@/lib/server/auth";
import { validateProductionServerConfig } from "@/lib/server/production-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(`[auth:logout:${requestId}] ${configCheck.logMessage}`);
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
		console.error(`[auth:logout:${requestId}] ${identity.message}`);
		return jsonError(500, "Authentication is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const headers = new Headers(responseHeaders);
	headers.append("Set-Cookie", createClearedAuthCookie());

	return applyResponseHeaders(
		Response.json({
			user: null,
			isAuthenticated: false,
			isAdmin: false,
			threadOwnerKey: getGuestThreadOwnerKey(identity.sessionId),
			requestId,
		}),
		{
			requestId,
			headers,
		},
	);
}
