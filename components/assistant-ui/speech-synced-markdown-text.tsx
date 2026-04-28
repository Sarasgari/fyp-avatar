"use client";

import { useMessage } from "@assistant-ui/react";
import { memo } from "react";
import { useShallow } from "zustand/shallow";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { useVoiceTranscriptStore } from "@/lib/tts/voice-transcript-store";

const SpeechSyncedMarkdownTextImpl = () => {
	const messageId = useMessage((state) => state.id);
	const { activeMessageId, displayedText, isSynchronizing } =
		useVoiceTranscriptStore(
			useShallow((state) => ({
				activeMessageId: state.activeMessageId,
				displayedText: state.displayedText,
				isSynchronizing: state.isSynchronizing,
			})),
		);

	const isActiveSpokenMessage =
		isSynchronizing && activeMessageId === messageId;

	if (!isActiveSpokenMessage) {
		return <MarkdownText />;
	}

	if (!displayedText) {
		return <div className="text-muted-foreground/70">...</div>;
	}

	// While speech is in progress, render a lightweight plain-text transcript
	// instead of reparsing markdown on every word reveal.
	return (
		<div className="whitespace-pre-wrap leading-normal">{displayedText}</div>
	);
};

export const SpeechSyncedMarkdownText = memo(SpeechSyncedMarkdownTextImpl);
