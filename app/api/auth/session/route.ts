import { applyResponseHeaders, jsonError } from "@/lib/server/api";
import {
	createIdentityResponseHeaders,
	resolveRequestIdentity,
} from "@/lib/server/auth";
import { validateProductionServerConfig } from "@/lib/server/production-config";
import { recordVisitor } from "@/lib/server/visitor-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig();
	if (!configCheck.ok) {
		console.error(`[auth:session:${requestId}] ${configCheck.logMessage}`);
		return jsonError(500, configCheck.clientMessage, { requestId });
	}

	const identity = await resolveRequestIdentity(request);
	const responseHeaders = createIdentityResponseHeaders(identity);

	if (!identity.ok) {
		console.error(`[auth:session:${requestId}] ${identity.message}`);
		return jsonError(500, "Authentication is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	recordVisitor({ request, identity });

	return applyResponseHeaders(
		Response.json({
			...identity.session,
			requestId,
		}),
		{
			requestId,
			headers: responseHeaders,
		},
	);
}
