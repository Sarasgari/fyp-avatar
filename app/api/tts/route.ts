import OpenAI from "openai";
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

export const runtime = "nodejs";

const MAX_TTS_INPUT_LENGTH = 4000;
const TTS_SESSION_RATE_LIMIT = {
	limit: 120,
	windowMs: 10 * 60 * 1_000,
} as const;
const TTS_IP_RATE_LIMIT = {
	limit: 240,
	windowMs: 10 * 60 * 1_000,
} as const;
const E2E_TTS_MODE = process.env.E2E_TTS_MODE?.trim() || "";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
	const requestId = crypto.randomUUID();
	const configCheck = validateProductionServerConfig({
		requiresOpenAi: E2E_TTS_MODE !== "fail",
	});
	if (!configCheck.ok) {
		console.error(`[tts:${requestId}] ${configCheck.logMessage}`);
		return jsonError(500, configCheck.clientMessage, { requestId });
	}

	const originCheck = ensureAllowedOrigin(req);
	const identity = await resolveRequestIdentity(req);
	const responseHeaders = new Headers({
		Vary: "Origin, Referer, Cookie",
	});

	if (identity.ok) {
		for (const [key, value] of identity.headers.entries()) {
			responseHeaders.append(key, value);
		}
	}

	if (!originCheck.allowed) {
		return jsonError(403, originCheck.message, {
			requestId,
			headers: responseHeaders,
		});
	}

	if (!identity.ok) {
		console.error(`[tts:${requestId}] ${identity.message}`);
		return jsonError(500, "Session protection is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const ipRateLimit = await consumeRateLimit({
		key: `tts:ip:${getClientIp(req)}`,
		...TTS_IP_RATE_LIMIT,
	});
	const sessionRateLimit = await consumeRateLimit({
		key: identity.session.user
			? `tts:user:${identity.session.user.id}`
			: `tts:session:${identity.sessionId}`,
		...TTS_SESSION_RATE_LIMIT,
	});
	const activeRateLimit = pickMostConstrainedRateLimit(
		ipRateLimit,
		sessionRateLimit,
	);

	if (!ipRateLimit.allowed || !sessionRateLimit.allowed) {
		const blockedRateLimit = ipRateLimit.allowed
			? sessionRateLimit
			: ipRateLimit;
		return jsonError(
			429,
			"Too many speech requests. Please try again shortly.",
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

	try {
		const body = await req.json().catch(() => null);
		const text =
			body &&
			typeof body === "object" &&
			typeof (body as { text?: unknown }).text === "string"
				? (body as { text: string }).text.trim()
				: "";

		if (!text) {
			return jsonError(400, "Text is required.", {
				requestId,
				rateLimit: activeRateLimit,
				headers: responseHeaders,
			});
		}

		if (text.length > MAX_TTS_INPUT_LENGTH) {
			return jsonError(
				413,
				`Text must be ${MAX_TTS_INPUT_LENGTH} characters or fewer.`,
				{
					requestId,
					rateLimit: activeRateLimit,
					headers: responseHeaders,
				},
			);
		}

		if (E2E_TTS_MODE === "fail") {
			return jsonError(503, "TTS is disabled for end-to-end test mode.", {
				requestId,
				rateLimit: activeRateLimit,
				headers: responseHeaders,
			});
		}

		if (!process.env.OPENAI_API_KEY) {
			console.error(`[tts:${requestId}] TTS route is missing OPENAI_API_KEY.`);
			return jsonError(500, "TTS is not configured.", {
				requestId,
				rateLimit: activeRateLimit,
				headers: responseHeaders,
			});
		}

		// Keep the route small and predictable: it accepts plain text and always
		// returns MP3 audio generated with the requested OpenAI TTS model/voice.
		const speech = await openai.audio.speech.create({
			model: "gpt-4o-mini-tts",
			voice: "nova",
			input: text,
			response_format: "mp3",
		});

		const audioBuffer = Buffer.from(await speech.arrayBuffer());

		return applyResponseHeaders(
			new Response(audioBuffer, {
				headers: {
					"Content-Length": String(audioBuffer.byteLength),
					"Content-Type": "audio/mpeg",
				},
			}),
			{
				requestId,
				rateLimit: activeRateLimit,
				headers: responseHeaders,
			},
		);
	} catch (error) {
		console.error(`[tts:${requestId}] Failed to synthesize speech.`, error);
		return jsonError(500, "Failed to synthesize speech.", {
			requestId,
			rateLimit: activeRateLimit,
			headers: responseHeaders,
		});
	}
}
