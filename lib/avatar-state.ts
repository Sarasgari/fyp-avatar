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
export type EmotionState = Emotion;

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

export const BODY_STATES = [
	"idleDance",
	"thinking",
	"sadPose",
	"listening",
	"wave",
	"celebration",
	"dance",
] as const;

export type BodyState = (typeof BODY_STATES)[number];

export const SPEECH_STATES = ["silent", "talking"] as const;

export type SpeechState = (typeof SPEECH_STATES)[number];

export type CharacterState = {
	emotionState: EmotionState;
	bodyState: BodyState;
	speechState: SpeechState;
};

export const DEFAULT_CHARACTER_STATE: CharacterState = {
	emotionState: "neutral",
	bodyState: "idleDance",
	speechState: "silent",
};

export const BODY_STATE_ANIMATION_PATHS: Partial<Record<BodyState, string>> = {
	idleDance: "/animations/idle-dance.vrma",
	thinking: "/animations/thinking.vrma",
	wave: "/animations/wave.vrma",
	celebration: "/animations/celebration.vrma",
	dance: "/animations/dance.vrma",
};

export const BODY_STATE_HOLD_MS: Record<BodyState, number> = {
	idleDance: 0,
	thinking: 0,
	sadPose: 1400,
	listening: 1000,
	wave: 1800,
	celebration: 2200,
	dance: 2600,
};

export type EmotionalAvatarState = Exclude<
	AvatarState,
	"idle" | "thinking" | "talking"
>;

export const isEmotion = (value: string): value is Emotion =>
	EMOTIONS.includes(value as Emotion);

export const isAvatarState = (value: string): value is AvatarState =>
	AVATAR_STATES.includes(value as AvatarState);

export const isBodyState = (value: string): value is BodyState =>
	BODY_STATES.includes(value as BodyState);

export const isSpeechState = (value: string): value is SpeechState =>
	SPEECH_STATES.includes(value as SpeechState);

export const emotionToAvatarState = (emotion: Emotion): AvatarState =>
	emotion === "neutral" ? "idle" : emotion;

export const emotionToBodyState = (emotion: EmotionState): BodyState =>
	emotion === "sad" ? "sadPose" : "listening";

export const avatarStateToBodyState = (
	avatarState: AvatarState,
	emotion: EmotionState,
): BodyState => {
	switch (avatarState) {
		case "thinking":
			return "thinking";
		case "idle":
			return "idleDance";
		case "talking":
			return emotionToBodyState(emotion);
		case "sad":
			return "sadPose";
		default:
			return emotionToBodyState(emotion);
	}
};

type ConversationCueInput = {
	emotion: EmotionState;
	replyText?: string;
	userText?: string;
};

const GREETING_PATTERN = /\b(hi|hello|hey|welcome|goodbye|bye)\b/i;
const CELEBRATION_PATTERN =
	/\b(congrats|congratulations|celebrate|celebration|well done|great job|you did it)\b/i;
const DANCE_PATTERN = /\b(dance|dancing|party|groove|rumba|boogie)\b/i;

export const resolveBodyStateFromConversation = ({
	emotion,
	replyText = "",
	userText = "",
}: ConversationCueInput): BodyState => {
	const combinedText = `${userText} ${replyText}`.trim();

	if (DANCE_PATTERN.test(combinedText)) {
		return "dance";
	}

	if (CELEBRATION_PATTERN.test(combinedText)) {
		return "celebration";
	}

	if (GREETING_PATTERN.test(replyText)) {
		return "wave";
	}

	return emotionToBodyState(emotion);
};
