import type { AvatarState } from "@/lib/avatar-state";

export const AVATAR_STATE_ACCENT_HEX: Record<AvatarState, string> = {
	idle: "#3b82f6",
	thinking: "#93c5fd",
	talking: "#2563eb",
	happy: "#60a5fa",
	sad: "#bfdbfe",
	anxious: "#ff6b4a",
	angry: "#ef4444",
	confused: "#7dd3fc",
	empathetic: "#eaf7ff",
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
