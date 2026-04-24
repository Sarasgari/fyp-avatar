"use client";

import { useThread } from "@assistant-ui/react";
import { useEffect, useRef } from "react";
import type { AvatarState, Emotion } from "@/lib/avatar-state";
import { getStructuredChatResponseFromMetadata } from "@/lib/chat-response";
import {
	DEFAULT_MIN_TTS_CHUNK_LENGTH,
	extractSpeakableChunks,
} from "@/lib/tts/extract-speakable-chunks";
import { requestTTS } from "@/lib/tts/request-tts";
import { useVoiceTranscriptStore } from "@/lib/tts/voice-transcript-store";
import {
	appendTranscriptChunk,
	buildTimedWordBoundaries,
	getRevealTextForTime,
} from "@/lib/tts/word-reveal";

const EMOTION_RESTORE_DURATION_MS = 1200;

type VoiceControllerProps = {
	onAvatarStateChange?: (state: AvatarState) => void;
	onEmotionChange?: (emotion: Emotion) => void;
	stopSpeechRequest?: number;
};

type AssistantContentPartLike = {
	type?: string;
	text?: string;
};

type AssistantMessageLike = {
	id: string;
	role: string;
	content?: readonly AssistantContentPartLike[];
	metadata?: unknown;
};

type QueuedAudioChunk = {
	id: number;
	runId: number;
	messageId: string;
	transcriptStart: string;
	text: string;
	status: "loading" | "ready" | "error";
	controller: AbortController;
	objectUrl?: string;
};

type VoiceSession = {
	runId: number;
	active: boolean;
	prevIsRunning: boolean;
	assistantComplete: boolean;
	speechStoppedForRun: boolean;
	baselineAssistantMessageId: string | null;
	baselineAssistantTextLength: number;
	currentAssistantMessageId: string | null;
	processedTextLength: number;
	buffer: string;
	pendingTtsCount: number;
	queue: QueuedAudioChunk[];
	nextQueueId: number;
	audio: HTMLAudioElement | null;
	isPlaying: boolean;
	hasStartedPlayback: boolean;
	scheduledTranscript: string;
	syncFrameId: number | null;
	lastAvatarState: AvatarState;
	lastEmotion: Emotion;
	detectedEmotion: Emotion;
	detectedAvatarState: AvatarState;
	detectedMessageId: string | null;
	restoreEmotionTimeoutId: number | null;
};

const getLatestAssistantMessage = (
	messages: readonly AssistantMessageLike[],
) => {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role === "assistant") {
			return message;
		}
	}

	return null;
};

const getSpeakableAssistantText = (message: AssistantMessageLike | null) => {
	if (!message?.content) return "";

	return message.content
		.filter(
			(part): part is { type: "text"; text: string } =>
				part.type === "text" && typeof part.text === "string",
		)
		.map((part) => part.text)
		.join("");
};

const getAssistantResponseMetadata = (message: AssistantMessageLike | null) => {
	if (!message) {
		return null;
	}

	return getStructuredChatResponseFromMetadata(message.metadata);
};

const isFreshAssistantResponse = (
	session: VoiceSession,
	message: AssistantMessageLike,
	fullAssistantText: string,
) =>
	message.id !== session.baselineAssistantMessageId ||
	fullAssistantText.length > session.baselineAssistantTextLength;

export const ThreadVoiceController = ({
	onAvatarStateChange,
	onEmotionChange,
	stopSpeechRequest = 0,
}: VoiceControllerProps) => {
	const isRunning = useThread((thread) => thread.isRunning);
	const messages = useThread((thread) => thread.messages);
	const handledStopRequestRef = useRef(stopSpeechRequest);
	const sessionRef = useRef<VoiceSession>({
		runId: 0,
		active: false,
		prevIsRunning: false,
		assistantComplete: false,
		speechStoppedForRun: false,
		baselineAssistantMessageId: null,
		baselineAssistantTextLength: 0,
		currentAssistantMessageId: null,
		processedTextLength: 0,
		buffer: "",
		pendingTtsCount: 0,
		queue: [],
		nextQueueId: 1,
		audio: null,
		isPlaying: false,
		hasStartedPlayback: false,
		scheduledTranscript: "",
		syncFrameId: null,
		lastAvatarState: "idle",
		lastEmotion: "neutral",
		detectedEmotion: "neutral",
		detectedAvatarState: "idle",
		detectedMessageId: null,
		restoreEmotionTimeoutId: null,
	});

	const setAvatarState = (nextState: AvatarState) => {
		const session = sessionRef.current;
		if (session.lastAvatarState === nextState) return;

		session.lastAvatarState = nextState;
		onAvatarStateChange?.(nextState);
	};

	const setEmotion = (nextEmotion: Emotion) => {
		const session = sessionRef.current;
		if (session.lastEmotion === nextEmotion) return;

		session.lastEmotion = nextEmotion;
		onEmotionChange?.(nextEmotion);
	};

	const clearEmotionRestoreTimeout = () => {
		const session = sessionRef.current;

		if (session.restoreEmotionTimeoutId !== null) {
			window.clearTimeout(session.restoreEmotionTimeoutId);
			session.restoreEmotionTimeoutId = null;
		}
	};

	const restoreDetectedEmotionThenIdle = () => {
		const session = sessionRef.current;

		clearEmotionRestoreTimeout();

		if (session.detectedAvatarState !== "idle") {
			setAvatarState(session.detectedAvatarState);
			session.restoreEmotionTimeoutId = window.setTimeout(() => {
				sessionRef.current.restoreEmotionTimeoutId = null;
				setAvatarState("idle");
			}, EMOTION_RESTORE_DURATION_MS);
			return;
		}

		setAvatarState("idle");
	};

	const syncAvatarState = () => {
		const session = sessionRef.current;

		if (session.restoreEmotionTimeoutId !== null) {
			return;
		}

		if (!session.active) {
			setAvatarState("idle");
			return;
		}

		// Thinking covers the streamed-text phase before we have playable audio.
		if (
			session.hasStartedPlayback &&
			(session.isPlaying ||
				session.queue.length > 0 ||
				session.pendingTtsCount > 0)
		) {
			setAvatarState("talking");
			return;
		}

		setAvatarState("thinking");
	};

	const revokeChunkUrl = (chunk: QueuedAudioChunk) => {
		if (!chunk.objectUrl) return;

		URL.revokeObjectURL(chunk.objectUrl);
		chunk.objectUrl = undefined;
	};

	const stopCurrentAudio = () => {
		const session = sessionRef.current;

		if (session.syncFrameId !== null) {
			cancelAnimationFrame(session.syncFrameId);
			session.syncFrameId = null;
		}

		if (!session.audio) {
			session.isPlaying = false;
			return;
		}

		session.audio.pause();
		session.audio.src = "";
		session.audio.onended = null;
		session.audio.onerror = null;
		session.audio = null;
		session.isPlaying = false;
	};

	const clearQueuedAudio = () => {
		const session = sessionRef.current;

		for (const chunk of session.queue) {
			chunk.controller.abort();
			revokeChunkUrl(chunk);
		}

		session.queue = [];
		session.pendingTtsCount = 0;
	};

	const finalizeIfDone = () => {
		const session = sessionRef.current;

		if (
			!session.active ||
			!session.assistantComplete ||
			session.isPlaying ||
			session.pendingTtsCount > 0 ||
			session.queue.length > 0
		) {
			syncAvatarState();
			return;
		}

		useVoiceTranscriptStore
			.getState()
			.endMessage(session.currentAssistantMessageId);
		session.active = false;
		session.assistantComplete = false;
		session.speechStoppedForRun = false;
		session.baselineAssistantMessageId = null;
		session.baselineAssistantTextLength = 0;
		session.currentAssistantMessageId = null;
		session.processedTextLength = 0;
		session.buffer = "";
		session.hasStartedPlayback = false;
		session.scheduledTranscript = "";

		restoreDetectedEmotionThenIdle();
	};

	const tryPlayNext = () => {
		const session = sessionRef.current;

		if (session.isPlaying) return;

		const nextChunk = session.queue[0];
		if (!nextChunk || nextChunk.status !== "ready" || !nextChunk.objectUrl) {
			finalizeIfDone();
			return;
		}

		const audio = new Audio(nextChunk.objectUrl);
		let hasStartedTranscriptSync = false;
		let lastDisplayedText = nextChunk.transcriptStart;

		const finishPlayback = () => {
			if (sessionRef.current.syncFrameId !== null) {
				cancelAnimationFrame(sessionRef.current.syncFrameId);
				sessionRef.current.syncFrameId = null;
			}

			useVoiceTranscriptStore
				.getState()
				.setDisplayedText(
					nextChunk.messageId,
					appendTranscriptChunk(nextChunk.transcriptStart, nextChunk.text),
				);

			revokeChunkUrl(nextChunk);

			if (sessionRef.current.queue[0]?.id === nextChunk.id) {
				sessionRef.current.queue.shift();
			}

			if (sessionRef.current.audio === audio) {
				audio.onended = null;
				audio.onerror = null;
				audio.src = "";
				sessionRef.current.audio = null;
			}

			sessionRef.current.isPlaying = false;
			tryPlayNext();
		};

		const startTranscriptSync = () => {
			if (hasStartedTranscriptSync) return;
			hasStartedTranscriptSync = true;

			const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
			const boundaries = buildTimedWordBoundaries(nextChunk.text, duration);

			const syncTranscript = () => {
				if (sessionRef.current.audio !== audio) return;

				const revealedText = appendTranscriptChunk(
					nextChunk.transcriptStart,
					getRevealTextForTime(
						nextChunk.text,
						boundaries,
						audio.currentTime,
						duration,
					),
				);

				if (revealedText !== lastDisplayedText) {
					lastDisplayedText = revealedText;
					useVoiceTranscriptStore
						.getState()
						.setDisplayedText(nextChunk.messageId, revealedText);
				}

				if (audio.ended) {
					return;
				}

				sessionRef.current.syncFrameId = requestAnimationFrame(syncTranscript);
			};

			sessionRef.current.syncFrameId = requestAnimationFrame(syncTranscript);
		};

		session.audio = audio;
		session.isPlaying = true;
		session.hasStartedPlayback = true;
		syncAvatarState();

		audio.onloadedmetadata = startTranscriptSync;
		audio.onended = finishPlayback;
		audio.onerror = () => {
			console.error("Audio playback failed for a queued TTS chunk.");
			finishPlayback();
		};

		void audio.play().catch((error) => {
			console.error("Audio playback was blocked or failed.", error);
			finishPlayback();
		});

		if (audio.readyState >= 1) {
			startTranscriptSync();
		}
	};

	const enqueueChunk = (text: string) => {
		const trimmedText = text.trim();
		if (!trimmedText) return;

		const session = sessionRef.current;
		if (session.speechStoppedForRun) return;
		if (!session.currentAssistantMessageId) return;

		const transcriptStart = session.scheduledTranscript;

		const runId = session.runId;
		const queueItem: QueuedAudioChunk = {
			id: session.nextQueueId,
			runId,
			messageId: session.currentAssistantMessageId,
			transcriptStart,
			text: trimmedText,
			status: "loading",
			controller: new AbortController(),
		};

		session.nextQueueId += 1;
		session.scheduledTranscript = appendTranscriptChunk(
			transcriptStart,
			trimmedText,
		);
		session.queue.push(queueItem);
		session.pendingTtsCount += 1;
		syncAvatarState();

		// Fire TTS requests as soon as chunks are ready, but keep playback ordered
		// by only ever playing the first ready item in the queue.
		void requestTTS(trimmedText, queueItem.controller.signal)
			.then((audioBlob) => {
				const activeSession = sessionRef.current;
				activeSession.pendingTtsCount = Math.max(
					0,
					activeSession.pendingTtsCount - 1,
				);

				if (activeSession.runId !== runId) {
					return;
				}

				const queuedChunk = activeSession.queue.find(
					(candidate) => candidate.id === queueItem.id,
				);

				if (!queuedChunk) {
					return;
				}

				queuedChunk.status = "ready";
				queuedChunk.objectUrl = URL.createObjectURL(audioBlob);
				tryPlayNext();
				syncAvatarState();
			})
			.catch((error) => {
				const activeSession = sessionRef.current;
				activeSession.pendingTtsCount = Math.max(
					0,
					activeSession.pendingTtsCount - 1,
				);

				if ((error as DOMException)?.name !== "AbortError") {
					console.error("TTS request failed for a queued chunk.", error);
					useVoiceTranscriptStore.getState().endMessage(queueItem.messageId);
				}

				const queueIndex = activeSession.queue.findIndex(
					(candidate) => candidate.id === queueItem.id,
				);

				if (queueIndex !== -1) {
					const [failedChunk] = activeSession.queue.splice(queueIndex, 1);
					failedChunk.controller.abort();
					revokeChunkUrl(failedChunk);
				}

				tryPlayNext();
				finalizeIfDone();
			});
	};

	const flushBufferedText = (final: boolean) => {
		const session = sessionRef.current;

		if (session.speechStoppedForRun) {
			session.buffer = "";
			finalizeIfDone();
			return;
		}

		const { chunks, remaining } = extractSpeakableChunks({
			buffer: session.buffer,
			final,
			minChunkLength: DEFAULT_MIN_TTS_CHUNK_LENGTH,
		});

		session.buffer = remaining;

		for (const chunk of chunks) {
			enqueueChunk(chunk);
		}
	};

	const stopSpeechForCurrentRun = () => {
		const session = sessionRef.current;

		if (!session.active && !session.isPlaying && session.queue.length === 0) {
			clearEmotionRestoreTimeout();
			setAvatarState("idle");
			return;
		}

		// Manual stop cancels the current audio plus any queued / in-flight TTS
		// work for this assistant turn, but leaves the text stream itself alone.
		stopCurrentAudio();
		clearQueuedAudio();
		session.speechStoppedForRun = true;
		session.buffer = "";
		session.hasStartedPlayback = false;
		session.scheduledTranscript = "";
		useVoiceTranscriptStore
			.getState()
			.endMessage(session.currentAssistantMessageId);
		finalizeIfDone();
	};

	const startRunSession = (
		messagesSnapshot: readonly AssistantMessageLike[],
	) => {
		const session = sessionRef.current;
		const latestAssistantMessage = getLatestAssistantMessage(messagesSnapshot);

		clearEmotionRestoreTimeout();
		stopCurrentAudio();
		clearQueuedAudio();

		session.runId += 1;
		session.active = true;
		session.assistantComplete = false;
		session.speechStoppedForRun = false;
		session.baselineAssistantMessageId = latestAssistantMessage?.id ?? null;
		session.baselineAssistantTextLength = getSpeakableAssistantText(
			latestAssistantMessage,
		).length;
		session.currentAssistantMessageId = null;
		session.processedTextLength = 0;
		session.buffer = "";
		session.nextQueueId = 1;
		session.hasStartedPlayback = false;
		session.scheduledTranscript = "";
		session.detectedEmotion = "neutral";
		session.detectedAvatarState = "idle";
		session.detectedMessageId = null;
		useVoiceTranscriptStore.getState().clear();

		setEmotion("neutral");
		setAvatarState("thinking");
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: The streaming/TTS session is stored in refs on purpose so helper identity changes do not restart playback bookkeeping.
	useEffect(() => {
		const session = sessionRef.current;
		const runningStarted = !session.prevIsRunning && isRunning;
		const runningStopped = session.prevIsRunning && !isRunning;

		if (runningStarted) {
			startRunSession(messages);
		}

		if (session.active) {
			const latestAssistantMessage = getLatestAssistantMessage(messages);

			if (latestAssistantMessage) {
				if (session.currentAssistantMessageId !== latestAssistantMessage.id) {
					session.currentAssistantMessageId = latestAssistantMessage.id;
					session.processedTextLength =
						latestAssistantMessage.id === session.baselineAssistantMessageId
							? session.baselineAssistantTextLength
							: 0;
					session.buffer = "";
				}

				const fullAssistantText = getSpeakableAssistantText(
					latestAssistantMessage,
				);

				if (
					isFreshAssistantResponse(
						session,
						latestAssistantMessage,
						fullAssistantText,
					)
				) {
					const metadata = getAssistantResponseMetadata(latestAssistantMessage);

					if (
						metadata &&
						session.detectedMessageId !== latestAssistantMessage.id
					) {
						session.detectedMessageId = latestAssistantMessage.id;
						session.detectedEmotion = metadata.emotion;
						session.detectedAvatarState = metadata.avatarState;
						setEmotion(metadata.emotion);
					}
				}

				if (fullAssistantText.length < session.processedTextLength) {
					session.processedTextLength = 0;
					session.buffer = "";
				}

				if (fullAssistantText.length > session.processedTextLength) {
					const newText = fullAssistantText.slice(session.processedTextLength);
					session.processedTextLength = fullAssistantText.length;

					if (session.speechStoppedForRun) {
						session.buffer = "";
					} else {
						useVoiceTranscriptStore
							.getState()
							.beginMessage(latestAssistantMessage.id);
						session.buffer += newText;
						flushBufferedText(false);
					}
				}
			}

			if (runningStopped) {
				session.assistantComplete = true;
				flushBufferedText(true);
				finalizeIfDone();
			} else {
				syncAvatarState();
			}
		}

		session.prevIsRunning = isRunning;
	}, [isRunning, messages]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: The stop request should react only to the incrementing signal, not to recreated helper closures.
	useEffect(() => {
		if (stopSpeechRequest === handledStopRequestRef.current) return;

		handledStopRequestRef.current = stopSpeechRequest;
		stopSpeechForCurrentRun();
	}, [stopSpeechRequest]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Cleanup should run once on unmount while operating on the current refs-backed audio session.
	useEffect(() => {
		return () => {
			clearEmotionRestoreTimeout();
			stopCurrentAudio();
			clearQueuedAudio();
			sessionRef.current.active = false;
			useVoiceTranscriptStore.getState().clear();
			setEmotion("neutral");
			setAvatarState("idle");
		};
	}, []);

	return null;
};
