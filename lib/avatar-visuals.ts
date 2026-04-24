import type { AvatarState } from "@/lib/avatar-state";

export const AVATAR_STATE_ACCENT_HEX: Record<AvatarState, string> = {
	idle: "#67e8f9",
	thinking: "#fbbf24",
	talking: "#5eead4",
	happy: "#34d399",
	sad: "#60a5fa",
	anxious: "#fb923c",
	angry: "#f87171",
	confused: "#a3e635",
	empathetic: "#f9a8d4",
};

export const getAvatarStateEnergy = (state: AvatarState) => {
	switch (state) {
		case "talking":
			return 1;
		case "thinking":
			return 0.65;
		case "happy":
			return 0.85;
		case "sad":
			return 0.48;
		case "anxious":
			return 0.9;
		case "angry":
			return 0.96;
		case "confused":
			return 0.72;
		case "empathetic":
			return 0.58;
		default:
			return 0.3;
	}
};
