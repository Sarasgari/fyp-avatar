"use client";

import { useThread, useThreadRuntime } from "@assistant-ui/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Thread, type ThreadProps } from "@/components/assistant-ui/thread";
import {
	hasPersistedMessages,
	PERSISTED_THREAD_STORAGE_KEY,
	parsePersistedThreadSnapshot,
	serializePersistedThreadSnapshot,
} from "@/lib/thread-persistence";

const THREAD_PERSISTENCE_DEBOUNCE_MS = 300;

export const PersistentThread = (props: ThreadProps) => {
	const threadRuntime = useThreadRuntime();
	const isRunning = useThread((thread) => thread.isRunning);
	const messageCount = useThread((thread) => thread.messages.length);
	const [isPersistenceReady, setIsPersistenceReady] = useState(false);
	const [hasSavedConversation, setHasSavedConversation] = useState(false);
	const persistTimerRef = useRef<number | null>(null);

	const persistThreadSnapshot = useEffectEvent(() => {
		const snapshot = threadRuntime.export();

		if (!hasPersistedMessages(snapshot)) {
			window.localStorage.removeItem(PERSISTED_THREAD_STORAGE_KEY);
			setHasSavedConversation(false);
			return;
		}

		window.localStorage.setItem(
			PERSISTED_THREAD_STORAGE_KEY,
			serializePersistedThreadSnapshot(snapshot),
		);
		setHasSavedConversation(true);
	});

	const clearConversation = useEffectEvent(() => {
		if (isRunning) return;

		const shouldClear = window.confirm(
			"Clear the saved conversation on this device?",
		);
		if (!shouldClear) return;

		if (persistTimerRef.current !== null) {
			window.clearTimeout(persistTimerRef.current);
			persistTimerRef.current = null;
		}
		threadRuntime.reset();
		window.localStorage.removeItem(PERSISTED_THREAD_STORAGE_KEY);
		setHasSavedConversation(false);
	});

	useEffect(() => {
		const persistedSnapshot = parsePersistedThreadSnapshot(
			window.localStorage.getItem(PERSISTED_THREAD_STORAGE_KEY),
		);

		if (persistedSnapshot) {
			setHasSavedConversation(hasPersistedMessages(persistedSnapshot.snapshot));

			if (threadRuntime.getState().messages.length === 0) {
				threadRuntime.import(persistedSnapshot.snapshot);
			}
		} else {
			window.localStorage.removeItem(PERSISTED_THREAD_STORAGE_KEY);
			setHasSavedConversation(false);
		}

		setIsPersistenceReady(true);

		return () => {
			if (persistTimerRef.current !== null) {
				window.clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}
		};
	}, [threadRuntime]);

	useEffect(() => {
		if (!isPersistenceReady) return;

		const queuePersist = () => {
			const { isRunning: threadIsRunning } = threadRuntime.getState();

			if (persistTimerRef.current !== null) {
				window.clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}

			if (threadIsRunning) {
				return;
			}

			persistTimerRef.current = window.setTimeout(() => {
				persistTimerRef.current = null;
				persistThreadSnapshot();
			}, THREAD_PERSISTENCE_DEBOUNCE_MS);
		};

		const unsubscribe = threadRuntime.subscribe(() => {
			queuePersist();
		});
		queuePersist();

		return () => {
			unsubscribe();
			if (persistTimerRef.current !== null) {
				window.clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}
		};
	}, [isPersistenceReady, threadRuntime]);

	return (
		<Thread
			{...props}
			isPersistenceReady={isPersistenceReady}
			hasSavedConversation={hasSavedConversation}
			onClearConversation={clearConversation}
			canClearConversation={
				isPersistenceReady &&
				!isRunning &&
				(hasSavedConversation || messageCount > 0)
			}
		/>
	);
};
