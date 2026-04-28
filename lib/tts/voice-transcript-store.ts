import { create } from "zustand";

type VoiceTranscriptState = {
	activeMessageId: string | null;
	displayedText: string;
	isSynchronizing: boolean;
	beginMessage: (messageId: string) => void;
	setDisplayedText: (messageId: string, displayedText: string) => void;
	endMessage: (messageId?: string | null) => void;
	clear: () => void;
};

// The transcript store keeps the currently spoken assistant message in sync with
// the visible text bubble, so words only appear after playback reaches them.
export const useVoiceTranscriptStore = create<VoiceTranscriptState>((set) => ({
	activeMessageId: null,
	displayedText: "",
	isSynchronizing: false,
	beginMessage: (messageId) =>
		set((state) => {
			if (state.activeMessageId === messageId && state.isSynchronizing) {
				return state;
			}

			return {
				activeMessageId: messageId,
				displayedText: "",
				isSynchronizing: true,
			};
		}),
	setDisplayedText: (messageId, displayedText) =>
		set((state) => {
			if (state.activeMessageId !== messageId) {
				return state;
			}

			if (state.displayedText === displayedText && state.isSynchronizing) {
				return state;
			}

			return {
				...state,
				displayedText,
				isSynchronizing: true,
			};
		}),
	endMessage: (messageId) =>
		set((state) => {
			if (messageId && state.activeMessageId !== messageId) {
				return state;
			}

			return {
				activeMessageId: null,
				displayedText: "",
				isSynchronizing: false,
			};
		}),
	clear: () => ({
		activeMessageId: null,
		displayedText: "",
		isSynchronizing: false,
	}),
}));
