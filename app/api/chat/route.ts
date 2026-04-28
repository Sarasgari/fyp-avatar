import { openai } from "@ai-sdk/openai";
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	generateId,
	generateObject,
	generateText,
	jsonSchema,
	type UIMessage,
} from "ai";
import { type Emotion, emotionToAvatarState } from "@/lib/avatar-state";
import {
	type AssistantChatUIMessage,
	createAssistantMessageMetadata,
	normalizeStructuredChatResponse,
	type StructuredChatResponse,
} from "@/lib/chat-response";
import {
	applyResponseHeaders,
	consumeRateLimit,
	ensureAllowedOrigin,
	getClientIp,
	jsonError,
	pickMostConstrainedRateLimit,
} from "@/lib/server/api";
import { resolveSession } from "@/lib/server/session";

export const runtime = "nodejs";

const CHAT_MODEL = openai("gpt-5-nano");
const CHAT_SESSION_RATE_LIMIT = {
	limit: 30,
	windowMs: 10 * 60 * 1_000,
} as const;
const CHAT_IP_RATE_LIMIT = {
	limit: 60,
	windowMs: 10 * 60 * 1_000,
} as const;
const MAX_CONTEXT_MESSAGES = 24;
const MAX_CONTEXT_CHARACTERS = 12_000;
const MAX_MESSAGE_CHARACTERS = 4_000;
const MAX_SYSTEM_PROMPT_CHARACTERS = 1_200;
const VALID_MESSAGE_ROLES = new Set(["system", "user", "assistant", "tool"]);

const EMOTION_RESPONSE_SCHEMA = jsonSchema<StructuredChatResponse>({
	type: "object",
	additionalProperties: false,
	properties: {
		emotion: {
			type: "string",
			enum: [
				"neutral",
				"happy",
				"sad",
				"anxious",
				"angry",
				"confused",
				"empathetic",
			],
		},
		avatarState: {
			type: "string",
			enum: [
				"idle",
				"thinking",
				"talking",
				"happy",
				"sad",
				"anxious",
				"angry",
				"confused",
				"empathetic",
			],
		},
		reply: {
			type: "string",
		},
	},
	required: ["emotion", "avatarState", "reply"],
});

const EMOTION_SYSTEM_PROMPT = `
Analyse the emotional tone of the user's most recent message while using the conversation for context.
Return exactly one emotion from this fixed list: neutral, happy, sad, anxious, angry, confused, empathetic.
Return a matching avatarState from this fixed list: idle, thinking, talking, happy, sad, anxious, angry, confused, empathetic.
Generate a helpful assistant reply for the user.
Use idle when the emotion is neutral.
Do not use thinking or talking as the avatarState for the final response.
Return only valid JSON that matches the requested schema.
Do not include markdown.
`.trim();

const FALLBACK_REPLY_SYSTEM_PROMPT = `
Reply helpfully to the user in plain conversational text.
Be supportive and clear, especially if the user sounds emotional.
Do not include markdown fences.
`.trim();

type ChatRequestPayload = {
	messages: UIMessage[];
	system?: string;
};

type ValidationResult<T> =
	| {
			ok: true;
			value: T;
	  }
	| {
			ok: false;
			message: string;
			status: number;
	  };

const FALLBACK_KEYWORDS: Record<Exclude<Emotion, "neutral">, string[]> = {
	happy: ["happy", "excited", "great", "amazing", "passed", "celebrate"],
	sad: ["sad", "down", "upset", "lonely", "depressed", "heartbroken"],
	anxious: [
		"anxious",
		"stress",
		"stressed",
		"worried",
		"deadline",
		"nervous",
		"overwhelmed",
		"panic",
	],
	angry: ["angry", "mad", "furious", "annoyed", "irritated", "frustrated"],
	confused: [
		"confused",
		"don't understand",
		"dont understand",
		"not sure",
		"unclear",
		"lost",
		"what do you mean",
	],
	empathetic: [
		"i feel for",
		"i'm sorry for",
		"im sorry for",
		"my condolences",
		"that sounds hard for them",
	],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object";

const getTextFromMessage = (message: UIMessage) =>
	message.parts
		.filter(
			(
				part,
			): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
				Boolean(part) &&
				typeof part === "object" &&
				part.type === "text" &&
				typeof part.text === "string",
		)
		.map((part) => part.text)
		.join("");

const getLatestUserMessageText = (messages: UIMessage[]) => {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];

		if (message.role === "user") {
			return getTextFromMessage(message).trim();
		}
	}

	return "";
};

const buildEmotionSystemPrompt = (system?: string) =>
	[system?.trim(), EMOTION_SYSTEM_PROMPT].filter(Boolean).join("\n\n");

const buildFallbackReplySystemPrompt = (system?: string) =>
	[system?.trim(), FALLBACK_REPLY_SYSTEM_PROMPT].filter(Boolean).join("\n\n");

const trimMessagesToBudget = (messages: UIMessage[]) => {
	const keptMessages: UIMessage[] = [];
	let totalCharacters = 0;

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (keptMessages.length >= MAX_CONTEXT_MESSAGES) {
			break;
		}

		const candidate = messages[index];
		const candidateLength = getTextFromMessage(candidate).length;

		if (
			keptMessages.length > 0 &&
			totalCharacters + candidateLength > MAX_CONTEXT_CHARACTERS
		) {
			break;
		}

		totalCharacters += candidateLength;
		keptMessages.unshift(candidate);
	}

	return keptMessages;
};

const validateChatRequest = (
	body: unknown,
): ValidationResult<ChatRequestPayload> => {
	if (!isRecord(body)) {
		return {
			ok: false,
			message: "Request body must be a JSON object.",
			status: 400,
		};
	}

	const { messages, system } = body;

	if (!Array.isArray(messages) || messages.length === 0) {
		return {
			ok: false,
			message: "At least one message is required.",
			status: 400,
		};
	}

	const validatedMessages: UIMessage[] = [];

	for (const candidate of messages) {
		if (
			!isRecord(candidate) ||
			typeof candidate.id !== "string" ||
			typeof candidate.role !== "string" ||
			!VALID_MESSAGE_ROLES.has(candidate.role) ||
			!Array.isArray(candidate.parts)
		) {
			return {
				ok: false,
				message: "Messages must match the expected assistant UI format.",
				status: 400,
			};
		}

		const typedMessage = candidate as unknown as UIMessage;
		const textLength = getTextFromMessage(typedMessage).trim().length;

		if (textLength > MAX_MESSAGE_CHARACTERS) {
			return {
				ok: false,
				message: `Each message must be ${MAX_MESSAGE_CHARACTERS} characters or fewer.`,
				status: 413,
			};
		}

		validatedMessages.push(typedMessage);
	}

	const trimmedMessages = trimMessagesToBudget(validatedMessages);
	if (getLatestUserMessageText(trimmedMessages) === "") {
		return {
			ok: false,
			message: "The latest user message cannot be empty.",
			status: 400,
		};
	}

	if (system !== undefined && system !== null && typeof system !== "string") {
		return {
			ok: false,
			message: "System instructions must be a string.",
			status: 400,
		};
	}

	const normalizedSystem = system?.trim();
	if (
		normalizedSystem &&
		normalizedSystem.length > MAX_SYSTEM_PROMPT_CHARACTERS
	) {
		return {
			ok: false,
			message: `System instructions must be ${MAX_SYSTEM_PROMPT_CHARACTERS} characters or fewer.`,
			status: 413,
		};
	}

	return {
		ok: true,
		value: {
			messages: trimmedMessages,
			system: normalizedSystem || undefined,
		},
	};
};

const detectFallbackEmotion = (text: string): Emotion => {
	const normalizedText = text.toLowerCase();
	let bestEmotion: Emotion = "neutral";
	let bestScore = 0;

	for (const [emotion, keywords] of Object.entries(FALLBACK_KEYWORDS) as [
		Exclude<Emotion, "neutral">,
		string[],
	][]) {
		const score = keywords.reduce(
			(total, keyword) => total + (normalizedText.includes(keyword) ? 1 : 0),
			0,
		);

		if (score > bestScore) {
			bestEmotion = emotion;
			bestScore = score;
		}
	}

	return bestEmotion;
};

export async function POST(req: Request) {
	const requestId = crypto.randomUUID();
	const originCheck = ensureAllowedOrigin(req);
	const session = resolveSession(req);
	const responseHeaders = new Headers({
		Vary: "Origin, Referer, Cookie",
	});

	if (session.ok && session.setCookieHeader) {
		responseHeaders.append("Set-Cookie", session.setCookieHeader);
	}

	if (!originCheck.allowed) {
		return jsonError(403, originCheck.message, {
			requestId,
			headers: responseHeaders,
		});
	}

	if (!session.ok) {
		console.error(`[chat:${requestId}] ${session.message}`);
		return jsonError(500, "Session protection is not configured.", {
			requestId,
			headers: responseHeaders,
		});
	}

	const ipRateLimit = await consumeRateLimit({
		key: `chat:ip:${getClientIp(req)}`,
		...CHAT_IP_RATE_LIMIT,
	});
	const sessionRateLimit = await consumeRateLimit({
		key: `chat:session:${session.sessionId}`,
		...CHAT_SESSION_RATE_LIMIT,
	});
	const activeRateLimit = pickMostConstrainedRateLimit(
		ipRateLimit,
		sessionRateLimit,
	);

	if (!ipRateLimit.allowed || !sessionRateLimit.allowed) {
		const blockedRateLimit = ipRateLimit.allowed
			? sessionRateLimit
			: ipRateLimit;
		return jsonError(429, "Too many chat requests. Please try again shortly.", {
			requestId,
			rateLimit: blockedRateLimit,
			headers: new Headers([
				...responseHeaders.entries(),
				["Retry-After", String(blockedRateLimit.retryAfterSeconds)],
			]),
		});
	}

	if (!process.env.OPENAI_API_KEY) {
		console.error(`[chat:${requestId}] Chat route is missing OPENAI_API_KEY.`);
		return jsonError(500, "Chat is not configured.", {
			requestId,
			rateLimit: activeRateLimit,
			headers: responseHeaders,
		});
	}

	const body = await req.json().catch(() => null);
	const validation = validateChatRequest(body);

	if (!validation.ok) {
		return jsonError(validation.status, validation.message, {
			requestId,
			rateLimit: activeRateLimit,
			headers: responseHeaders,
		});
	}

	const { messages, system } = validation.value;

	const latestUserMessage = getLatestUserMessageText(messages);
	let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;

	try {
		modelMessages = await convertToModelMessages(messages);
	} catch (error) {
		console.error(`[chat:${requestId}] Invalid message payload.`, error);
		return jsonError(400, "Messages could not be parsed.", {
			requestId,
			rateLimit: activeRateLimit,
			headers: responseHeaders,
		});
	}

	let structuredResponse: StructuredChatResponse;

	try {
		const { object } = await generateObject({
			model: CHAT_MODEL,
			messages: modelMessages,
			system: buildEmotionSystemPrompt(system),
			schema: EMOTION_RESPONSE_SCHEMA,
			schemaName: "avatarEmotionReply",
			schemaDescription:
				"Emotion classification and assistant reply for an expressive avatar chat app.",
		});

		structuredResponse = normalizeStructuredChatResponse(object);
	} catch (emotionError) {
		console.error(
			`[chat:${requestId}] Structured emotion classification failed.`,
			emotionError,
		);

		const fallbackEmotion = detectFallbackEmotion(latestUserMessage);
		let fallbackReply =
			"I'm sorry, I had trouble responding just now. Please try again.";

		try {
			const { text } = await generateText({
				model: CHAT_MODEL,
				messages: modelMessages,
				system: buildFallbackReplySystemPrompt(system),
			});

			if (text.trim()) {
				fallbackReply = text.trim();
			}
		} catch (replyError) {
			console.error(
				`[chat:${requestId}] Fallback reply generation failed.`,
				replyError,
			);
		}

		structuredResponse = {
			emotion: fallbackEmotion,
			avatarState: emotionToAvatarState(fallbackEmotion),
			reply: fallbackReply,
		};
	}

	const stream = createUIMessageStream<AssistantChatUIMessage>({
		originalMessages: messages as AssistantChatUIMessage[],
		execute: ({ writer }) => {
			const textPartId = generateId();
			const messageMetadata =
				createAssistantMessageMetadata(structuredResponse);

			writer.write({
				type: "start",
				messageMetadata,
			});
			writer.write({
				type: "text-start",
				id: textPartId,
			});
			writer.write({
				type: "text-delta",
				id: textPartId,
				delta: structuredResponse.reply,
			});
			writer.write({
				type: "text-end",
				id: textPartId,
			});
			writer.write({
				type: "finish",
				finishReason: "stop",
				messageMetadata,
			});
		},
		onError: (error) => {
			console.error(
				`[chat:${requestId}] Failed to stream chat response.`,
				error,
			);
			return "Failed to respond.";
		},
	});

	return applyResponseHeaders(createUIMessageStreamResponse({ stream }), {
		requestId,
		rateLimit: activeRateLimit,
		headers: responseHeaders,
	});
}
