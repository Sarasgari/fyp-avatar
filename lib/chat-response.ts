import type { UIMessage } from "ai";
import {
	type AvatarState,
	type Emotion,
	emotionToAvatarState,
	isAvatarState,
	isEmotion,
} from "@/lib/avatar-state";

export type StructuredChatResponse = {
	emotion: Emotion;
	avatarState: AvatarState;
	reply: string;
};

export type AssistantMessageMetadata = Partial<StructuredChatResponse> & {
	custom?: StructuredChatResponse;
};
export type AssistantChatUIMessage = UIMessage<AssistantMessageMetadata>;

export const isStructuredChatResponse = (
	value: unknown,
): value is StructuredChatResponse => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.emotion === "string" &&
		isEmotion(candidate.emotion) &&
		typeof candidate.avatarState === "string" &&
		isAvatarState(candidate.avatarState) &&
		typeof candidate.reply === "string"
	);
};

export const normalizeStructuredChatResponse = (
	response: StructuredChatResponse,
): StructuredChatResponse => {
	const reply = response.reply.trim();

	return {
		emotion: response.emotion,
		avatarState: emotionToAvatarState(response.emotion),
		reply,
	};
};

export const createAssistantMessageMetadata = (
	response: StructuredChatResponse,
): AssistantMessageMetadata => ({
	...response,
	custom: response,
});

export const getStructuredChatResponseFromMetadata = (
	metadata: unknown,
): StructuredChatResponse | null => {
	if (isStructuredChatResponse(metadata)) {
		return metadata;
	}

	if (
		metadata &&
		typeof metadata === "object" &&
		"custom" in metadata &&
		isStructuredChatResponse((metadata as { custom?: unknown }).custom)
	) {
		return (metadata as { custom: StructuredChatResponse }).custom;
	}

	return null;
};
