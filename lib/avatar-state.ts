export const EMOTIONS = [
	"neutral",
	"happy",
	"sad",
	"anxious",
	"angry",
	"confused",
	"empathetic",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export const AVATAR_STATES = [
	"idle",
	"thinking",
	"talking",
	"happy",
	"sad",
	"anxious",
	"angry",
	"confused",
	"empathetic",
] as const;

export type AvatarState = (typeof AVATAR_STATES)[number];

export type EmotionalAvatarState = Exclude<
	AvatarState,
	"idle" | "thinking" | "talking"
>;

export const isEmotion = (value: string): value is Emotion =>
	EMOTIONS.includes(value as Emotion);

export const isAvatarState = (value: string): value is AvatarState =>
	AVATAR_STATES.includes(value as AvatarState);

export const emotionToAvatarState = (emotion: Emotion): AvatarState =>
	emotion === "neutral" ? "idle" : emotion;
