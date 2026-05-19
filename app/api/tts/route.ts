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
const DEFAULT_ELEVENLABS_VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

const getTtsProvider = () => {
	const provider = process.env.TTS_PROVIDER?.trim().toLowerCase() || "openai";
	return provider === "elevenlabs" ? "elevenlabs" : "openai";
};

const getTtsConfigError = (ttsProvider: ReturnType<typeof getTtsProvider>) => {
	if (ttsProvider === "elevenlabs") {
		return process.env.ELEVENLABS_API_KEY?.trim()
			? null
			: "ELEVENLABS_API_KEY is missing.";
	}

	return process.env.OPENAI_API_KEY?.trim()
		? null
		: "OPENAI_API_KEY is missing.";
};

const createOpenAiSpeech = async (text: string) => {
	const apiKey = process.env.OPENAI_API_KEY?.trim();

	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is required for OpenAI TTS.");
	}

	const openai = new OpenAI({ apiKey });
	const speech = await openai.audio.speech.create({
		model: "gpt-4o-mini-tts",
		voice: "nova",
		input: text,
		response_format: "mp3",
	});

	return Buffer.from(await speech.arrayBuffer());
};

const createElevenLabsSpeech = async (text: string) => {
	const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

	if (!apiKey) {
		throw new Error("ELEVENLABS_API_KEY is required for ElevenLabs TTS.");
	}

	const voiceId =
		process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_ELEVENLABS_VOICE_ID;
	const modelId =
		process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_ELEVENLABS_MODEL_ID;
	const outputFormat =
		process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() ||
		DEFAULT_ELEVENLABS_OUTPUT_FORMAT;
	const response = await fetch(
		`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
			voiceId,
		)}/stream?output_format=${encodeURIComponent(outputFormat)}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"xi-api-key": apiKey,
			},
			body: JSON.stringify({
				model_id: modelId,
				text,
			}),
			cache: "no-store",
		},
	);

	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`ElevenLabs TTS returned ${response.status}${
				errorBody ? ` ${errorBody.slice(0, 300)}` : ""
			}`,
		);
	}

	return Buffer.from(await response.arrayBuffer());
};

export async function POST(req: Request) {
	const requestId = crypto.randomUUID();
	const ttsProvider = getTtsProvider();
	const configCheck = validateProductionServerConfig({
		requiresElevenLabs: E2E_TTS_MODE !== "fail" && ttsProvider === "elevenlabs",
		requiresOpenAi: E2E_TTS_MODE !== "fail" && ttsProvider === "openai",
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

		const configError = getTtsConfigError(ttsProvider);
		if (configError) {
			console.error(`[tts:${requestId}] ${configError}`);
			return jsonError(500, `TTS is not configured: ${configError}`, {
				requestId,
				rateLimit: activeRateLimit,
				headers: responseHeaders,
			});
		}

		const audioBuffer =
			ttsProvider === "elevenlabs"
				? await createElevenLabsSpeech(text)
				: await createOpenAiSpeech(text);

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
		const errorMessage =
			process.env.NODE_ENV === "production"
				? "Failed to synthesize speech."
				: `Failed to synthesize speech with ${getTtsProvider()}: ${
						error instanceof Error ? error.message : "Unknown error."
					}`;
		return jsonError(500, errorMessage, {
			requestId,
			rateLimit: activeRateLimit,
			headers: responseHeaders,
		});
	}
}
