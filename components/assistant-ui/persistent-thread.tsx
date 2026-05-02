"use client";

import { useThread, useThreadRuntime } from "@assistant-ui/react";
import {
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { Thread, type ThreadProps } from "@/components/assistant-ui/thread";
import {
	coercePersistedThreadSnapshot,
	createEmptyThreadExternalState,
	createPersistedThreadSnapshot,
	getPersistedThreadStorageKey,
	hasPersistedMessages,
	type PersistedThreadSnapshot,
	parsePersistedThreadSnapshot,
} from "@/lib/thread-persistence";

const THREAD_PERSISTENCE_DEBOUNCE_MS = 300;

type ThreadSnapshotResponse = {
	snapshot?: unknown;
};

const saveSnapshotLocally = (
	storageKey: string,
	snapshot: PersistedThreadSnapshot,
) => {
	window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
};

const removeLocalSnapshot = (storageKey: string) => {
	window.localStorage.removeItem(storageKey);
};

const loadThreadSnapshotFromServer = async () => {
	try {
		const response = await fetch("/api/thread", {
			cache: "no-store",
			credentials: "same-origin",
		});

		if (!response.ok) {
			throw new Error(`Thread load returned ${response.status}.`);
		}

		const body = (await response
			.json()
			.catch(() => null)) as ThreadSnapshotResponse | null;

		return {
			ok: true as const,
			snapshot: coercePersistedThreadSnapshot(body?.snapshot),
		};
	} catch (error) {
		console.error(
			"Failed to load the saved conversation from the server.",
			error,
		);
		return {
			ok: false as const,
			snapshot: null,
		};
	}
};

const saveThreadSnapshotToServer = async (
	snapshot: PersistedThreadSnapshot,
	{ keepalive = false }: { keepalive?: boolean } = {},
) => {
	const response = await fetch("/api/thread", {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
		},
		cache: "no-store",
		credentials: "same-origin",
		keepalive,
		body: JSON.stringify({
			snapshot,
		}),
	});

	if (!response.ok) {
		throw new Error(`Thread save returned ${response.status}.`);
	}
};

const deleteThreadSnapshotFromServer = async ({
	keepalive = false,
}: {
	keepalive?: boolean;
} = {}) => {
	const response = await fetch("/api/thread", {
		method: "DELETE",
		cache: "no-store",
		credentials: "same-origin",
		keepalive,
	});

	if (!response.ok && response.status !== 204) {
		throw new Error(`Thread delete returned ${response.status}.`);
	}
};

type PersistentThreadProps = ThreadProps & {
	storageOwnerKey: string | null;
};

export const PersistentThread = ({
	storageOwnerKey,
	...props
}: PersistentThreadProps) => {
	const threadRuntime = useThreadRuntime();
	const isRunning = useThread((thread) => thread.isRunning);
	const messageCount = useThread((thread) => thread.messages.length);
	const [isPersistenceReady, setIsPersistenceReady] = useState(false);
	const [hasSavedConversation, setHasSavedConversation] = useState(false);
	const isHydratingRef = useRef(false);
	const persistTimerRef = useRef<number | null>(null);
	const lastPersistedSnapshotRef = useRef<PersistedThreadSnapshot | null>(null);
	const previousStorageOwnerKeyRef = useRef<string | null>(null);
	const wasThreadRunningRef = useRef(false);
	const persistenceScope = storageOwnerKey?.startsWith("user:")
		? "user"
		: "guest";
	const persistenceTargetLabel =
		persistenceScope === "user" ? "your account" : "this session";

	const flushThreadSnapshot = useEffectEvent(
		async ({
			keepalive = false,
			allowDelete = true,
		}: {
			keepalive?: boolean;
			allowDelete?: boolean;
		} = {}) => {
			if (!storageOwnerKey) {
				return;
			}

			const exportedSnapshot = threadRuntime.exportExternalState();
			const storageKey = getPersistedThreadStorageKey(storageOwnerKey);

			if (!hasPersistedMessages(exportedSnapshot)) {
				const fallbackSnapshot = lastPersistedSnapshotRef.current;
				if (!allowDelete) {
					if (fallbackSnapshot) {
						saveSnapshotLocally(storageKey, fallbackSnapshot);

						try {
							await saveThreadSnapshotToServer(fallbackSnapshot, {
								keepalive,
							});
						} catch (error) {
							console.error(
								"Failed to preserve the saved conversation on the server.",
								error,
							);
						}
					}

					return;
				}

				removeLocalSnapshot(storageKey);
				setHasSavedConversation(false);
				lastPersistedSnapshotRef.current = null;

				try {
					await deleteThreadSnapshotFromServer({ keepalive });
				} catch (error) {
					console.error(
						"Failed to clear the saved conversation on the server.",
						error,
					);
				}

				return;
			}

			const snapshot = createPersistedThreadSnapshot(exportedSnapshot);
			saveSnapshotLocally(storageKey, snapshot);
			setHasSavedConversation(true);
			lastPersistedSnapshotRef.current = snapshot;

			try {
				await saveThreadSnapshotToServer(snapshot, { keepalive });
			} catch (error) {
				console.error("Failed to save the conversation on the server.", error);
			}
		},
	);

	const clearConversation = useEffectEvent(async () => {
		if (isRunning || !storageOwnerKey) return;

		const shouldClear = window.confirm(
			`Clear the saved conversation from ${persistenceTargetLabel}?`,
		);
		if (!shouldClear) return;

		try {
			await deleteThreadSnapshotFromServer();
		} catch (error) {
			console.error(
				"Failed to clear the saved conversation on the server.",
				error,
			);
			window.alert("Failed to clear the saved conversation. Please try again.");
			return;
		}

		if (persistTimerRef.current !== null) {
			window.clearTimeout(persistTimerRef.current);
			persistTimerRef.current = null;
		}
		wasThreadRunningRef.current = false;
		lastPersistedSnapshotRef.current = null;
		threadRuntime.importExternalState(createEmptyThreadExternalState());
		removeLocalSnapshot(getPersistedThreadStorageKey(storageOwnerKey));
		setHasSavedConversation(false);
	});

	useLayoutEffect(() => {
		if (!storageOwnerKey) {
			setHasSavedConversation(false);
			setIsPersistenceReady(false);
			return;
		}

		let isCancelled = false;
		const previousStorageOwnerKey = previousStorageOwnerKeyRef.current;
		const shouldCarryThreadIntoAccount = Boolean(
			previousStorageOwnerKey?.startsWith("guest:") &&
				storageOwnerKey.startsWith("user:"),
		);
		const shouldClearThreadAfterSignOut = Boolean(
			previousStorageOwnerKey?.startsWith("user:") &&
				storageOwnerKey.startsWith("guest:"),
		);
		const previousStorageKey = previousStorageOwnerKey
			? getPersistedThreadStorageKey(previousStorageOwnerKey)
			: null;
		const carriedSnapshot = shouldCarryThreadIntoAccount
			? (() => {
					const exportedSnapshot = threadRuntime.exportExternalState();
					return hasPersistedMessages(exportedSnapshot)
						? createPersistedThreadSnapshot(exportedSnapshot)
						: null;
				})()
			: null;
		isHydratingRef.current = true;
		wasThreadRunningRef.current = false;
		lastPersistedSnapshotRef.current = null;
		setHasSavedConversation(false);
		setIsPersistenceReady(false);

		const loadPersistedThread = async () => {
			const storageKey = getPersistedThreadStorageKey(storageOwnerKey);

			threadRuntime.importExternalState(createEmptyThreadExternalState());

			if (shouldClearThreadAfterSignOut) {
				removeLocalSnapshot(storageKey);

				try {
					await deleteThreadSnapshotFromServer();
				} catch (error) {
					console.error(
						"Failed to clear the guest conversation after sign-out.",
						error,
					);
				}

				if (isCancelled) return;

				lastPersistedSnapshotRef.current = null;
				setHasSavedConversation(false);
				setIsPersistenceReady(true);
				isHydratingRef.current = false;
				previousStorageOwnerKeyRef.current = storageOwnerKey;
				return;
			}

			const localSnapshot = parsePersistedThreadSnapshot(
				window.localStorage.getItem(storageKey),
			);
			const serverResult = await loadThreadSnapshotFromServer();

			if (isCancelled) return;

			let resolvedSnapshot = serverResult.ok
				? serverResult.snapshot
				: localSnapshot;

			if (serverResult.ok) {
				if (serverResult.snapshot) {
					saveSnapshotLocally(storageKey, serverResult.snapshot);
				} else {
					removeLocalSnapshot(storageKey);
					resolvedSnapshot = null;
				}
			}

			if (!resolvedSnapshot && carriedSnapshot) {
				resolvedSnapshot = carriedSnapshot;
				saveSnapshotLocally(storageKey, carriedSnapshot);
				if (previousStorageKey) {
					// Avoid reviving the pre-login guest cache after sign-out.
					removeLocalSnapshot(previousStorageKey);
				}

				try {
					await saveThreadSnapshotToServer(carriedSnapshot);
				} catch (error) {
					console.error(
						"Failed to persist the migrated conversation to the server.",
						error,
					);
				}
			}

			if (resolvedSnapshot) {
				threadRuntime.importExternalState(resolvedSnapshot.snapshot);
			} else {
				threadRuntime.importExternalState(createEmptyThreadExternalState());
			}

			lastPersistedSnapshotRef.current = resolvedSnapshot;
			setHasSavedConversation(
				Boolean(
					resolvedSnapshot && hasPersistedMessages(resolvedSnapshot.snapshot),
				),
			);
			setIsPersistenceReady(true);
			isHydratingRef.current = false;
			previousStorageOwnerKeyRef.current = storageOwnerKey;
		};

		void loadPersistedThread();

		return () => {
			isCancelled = true;
			isHydratingRef.current = false;
			if (persistTimerRef.current !== null) {
				window.clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}
		};
	}, [storageOwnerKey, threadRuntime]);

	useEffect(() => {
		if (!isPersistenceReady || !storageOwnerKey) return;

		const handlePageHide = () => {
			void flushThreadSnapshot({ keepalive: true, allowDelete: false });
		};

		window.addEventListener("pagehide", handlePageHide);

		return () => {
			window.removeEventListener("pagehide", handlePageHide);
		};
	}, [isPersistenceReady, storageOwnerKey]);

	useEffect(() => {
		if (!isPersistenceReady || !storageOwnerKey) return;

		const queuePersist = () => {
			if (isHydratingRef.current) {
				return;
			}

			const { isRunning: threadIsRunning } = threadRuntime.getState();

			if (persistTimerRef.current !== null) {
				window.clearTimeout(persistTimerRef.current);
				persistTimerRef.current = null;
			}

			if (threadIsRunning) {
				wasThreadRunningRef.current = true;
				return;
			}

			if (wasThreadRunningRef.current) {
				wasThreadRunningRef.current = false;
				void flushThreadSnapshot();
				return;
			}

			persistTimerRef.current = window.setTimeout(() => {
				persistTimerRef.current = null;
				void flushThreadSnapshot();
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
	}, [isPersistenceReady, storageOwnerKey, threadRuntime]);

	return (
		<Thread
			{...props}
			isPersistenceReady={isPersistenceReady}
			hasSavedConversation={hasSavedConversation}
			persistenceScope={persistenceScope}
			onClearConversation={clearConversation}
			canClearConversation={
				isPersistenceReady &&
				!isRunning &&
				(hasSavedConversation || messageCount > 0)
			}
		/>
	);
};
