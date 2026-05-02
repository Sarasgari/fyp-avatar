import { type AvatarId, DEFAULT_AVATAR_ID, isAvatarId } from "./avatar-catalog";

export const USER_PREFERENCES_STORAGE_KEY = "fyp-avatar:preferences:v1";
export const USER_AVATAR_SELECTION_STORAGE_KEY =
	"fyp-avatar:user-avatar-selection:v1";

export type UserPreferences = {
	voiceEnabled: boolean;
	avatarVisible: boolean;
	reducedMotion: boolean;
	compactChat: boolean;
	avatarId: AvatarId;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
	voiceEnabled: true,
	avatarVisible: true,
	reducedMotion: false,
	compactChat: false,
	avatarId: DEFAULT_AVATAR_ID,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const coerceUserPreferences = (
	value: unknown,
	defaults: UserPreferences = DEFAULT_USER_PREFERENCES,
): UserPreferences => {
	if (!isRecord(value)) {
		return defaults;
	}

	return {
		voiceEnabled:
			typeof value.voiceEnabled === "boolean"
				? value.voiceEnabled
				: defaults.voiceEnabled,
		avatarVisible:
			typeof value.avatarVisible === "boolean"
				? value.avatarVisible
				: defaults.avatarVisible,
		reducedMotion:
			typeof value.reducedMotion === "boolean"
				? value.reducedMotion
				: defaults.reducedMotion,
		compactChat:
			typeof value.compactChat === "boolean"
				? value.compactChat
				: defaults.compactChat,
		avatarId:
			typeof value.avatarId === "string" && isAvatarId(value.avatarId)
				? value.avatarId
				: defaults.avatarId,
	};
};

export const parseUserPreferences = (
	rawPreferences: string | null,
	defaults: UserPreferences = DEFAULT_USER_PREFERENCES,
) => {
	if (!rawPreferences) {
		return defaults;
	}

	try {
		return coerceUserPreferences(
			JSON.parse(rawPreferences) as unknown,
			defaults,
		);
	} catch {
		return defaults;
	}
};

export const serializeUserPreferences = (preferences: UserPreferences) =>
	JSON.stringify(preferences);
