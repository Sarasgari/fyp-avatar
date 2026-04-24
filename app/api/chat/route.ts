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

const CHAT_MODEL = openai("gpt-5-nano");

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

const getTextFromMessage = (message: UIMessage) =>
	message.parts
		.filter(
			(
				part,
			): part is Extract<(typeof message.parts)[number], { type: "text" }> =>
				part.type === "text" && typeof part.text === "string",
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
	const { messages, system }: { messages: UIMessage[]; system?: string } =
		await req.json();

	const latestUserMessage = getLatestUserMessageText(messages);
	const modelMessages = await convertToModelMessages(messages);
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
		console.error("Structured emotion classification failed.", emotionError);

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
			console.error("Fallback reply generation failed.", replyError);
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
			console.error("Failed to stream chat response.", error);
			return "Failed to respond.";
		},
	});

	return createUIMessageStreamResponse({ stream });
}
