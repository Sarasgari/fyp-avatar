import type { AvatarState } from "@/lib/avatar-state";

export const AVATAR_STATE_ACCENT_HEX: Record<AvatarState, string> = {
	idle: "#67e8f9",
	thinking: "#fbbf24",
	talking: "#5eead4",
};

export const getAvatarStateEnergy = (state: AvatarState) => {
	switch (state) {
		case "talking":
			return 1;
		case "thinking":
			return 0.65;
		default:
			return 0.3;
	}
};
