import { applyResponseHeaders, jsonError } from "@/lib/server/api";
import {
	createIdentityResponseHeaders,
	resolveRequestIdentity,
} from "@/lib/server/auth";
import { validateProductionServerConfig } from "@/lib/server/production-config";
import { listVisitors } from "@/lib/server/visitor-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(`[admin:visitors:${requestId}] ${configCheck.logMessage}`);
		return jsonError(500, configCheck.clientMessage, { requestId });
	}

	const identity = await resolveRequestIdentity(request);
	const responseHeaders = createIdentityResponseHeaders(identity);

	if (!identity.ok) {
		console.error(`[admin:visitors:${requestId}] ${identity.message}`);
		return jsonError(500, "Authentication is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	if (!identity.session.isAdmin) {
		return jsonError(403, "Admin access is required.", {
			requestId,
			headers: responseHeaders,
		});
	}

	return applyResponseHeaders(
		Response.json({
			visitors: listVisitors(),
			requestId,
		}),
		{
			requestId,
			headers: responseHeaders,
		},
	);
}
