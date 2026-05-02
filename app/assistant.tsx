"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import {
	AudioLinesIcon,
	EyeOffIcon,
	LayoutDashboardIcon,
	LoaderCircleIcon,
	MessageCircleIcon,
	ShieldCheckIcon,
	TriangleAlertIcon,
	VolumeXIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PersistentThread } from "@/components/assistant-ui/persistent-thread";
import { AccountControls } from "@/components/auth/account-controls";
import { AvatarPickerDialog } from "@/components/avatar/avatar-picker";
import { SiteLogoMark } from "@/components/brand/site-logo";
import { UserDashboard } from "@/components/dashboard/user-dashboard";
import { PreferencesDialog } from "@/components/preferences/preferences-dialog";
import AppScene from "@/components/scene/app-scene";
import AvatarCanvas, {
	type AvatarCanvasStatus,
} from "@/components/ui/avatar-canvas";
import { Button } from "@/components/ui/button";
import type { AuthSessionState } from "@/lib/auth";
import type { AvatarId } from "@/lib/avatar-catalog";
import {
	DEFAULT_AVATAR_ID,
	getAvatarOption,
	isAvatarId,
} from "@/lib/avatar-catalog";
import {
	type BodyState,
	type EmotionState,
	emotionToAvatarState,
	type SpeechState,
} from "@/lib/avatar-state";
import type { AssistantChatUIMessage } from "@/lib/chat-response";
import {
	DEFAULT_USER_PREFERENCES,
	parseUserPreferences,
	serializeUserPreferences,
	USER_AVATAR_SELECTION_STORAGE_KEY,
	USER_PREFERENCES_STORAGE_KEY,
	type UserPreferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

type AuthSessionResponse = AuthSessionState & {
	requestId: string;
};

type ActiveView = "assistant" | "dashboard";

const bodyLabels: Record<BodyState, string> = {
	idleDance: "Idle groove",
	thinking: "Thinking pose",
	sadPose: "Reflective pose",
	listening: "Listening pose",
	wave: "Greeting pose",
	celebration: "Celebration pose",
	dance: "Dance pose",
};

const getBrowserDefaultPreferences = (): UserPreferences => ({
	...DEFAULT_USER_PREFERENCES,
	reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
});

const readAvatarSelections = () => {
	try {
		const parsed = JSON.parse(
			window.localStorage.getItem(USER_AVATAR_SELECTION_STORAGE_KEY) ?? "{}",
		) as unknown;

		if (!parsed || typeof parsed !== "object") {
			return {};
		}

		return Object.fromEntries(
			Object.entries(parsed as Record<string, unknown>).filter(
				([, avatarId]) => typeof avatarId === "string" && isAvatarId(avatarId),
			),
		) as Record<string, AvatarId>;
	} catch {
		return {};
	}
};

const writeAvatarSelection = (userId: string, avatarId: AvatarId) => {
	const selections = readAvatarSelections();
	window.localStorage.setItem(
		USER_AVATAR_SELECTION_STORAGE_KEY,
		JSON.stringify({
			...selections,
			[userId]: avatarId,
		}),
	);
};

const getAvatarStatusModel = (
	status: AvatarCanvasStatus,
	avatarVisible: boolean,
) => {
	if (!avatarVisible) {
		return {
			icon: EyeOffIcon,
			tone: "default" as const,
			value: "Hidden",
		};
	}

	switch (status) {
		case "ready":
			return {
				icon: ShieldCheckIcon,
				tone: "success" as const,
				value: "Live avatar",
			};
		case "error":
			return {
				icon: TriangleAlertIcon,
				tone: "warning" as const,
				value: "Fallback mode",
			};
		case "unsupported":
			return {
				icon: TriangleAlertIcon,
				tone: "warning" as const,
				value: "WebGL unavailable",
			};
		default:
			return {
				icon: LoaderCircleIcon,
				tone: "default" as const,
				value: "Loading avatar",
			};
	}
};

const getVoiceStatusModel = (
	speechState: SpeechState,
	bodyState: BodyState,
	voiceEnabled: boolean,
) => {
	if (!voiceEnabled) {
		return {
			icon: VolumeXIcon,
			tone: "default" as const,
			value: "Muted",
		};
	}

	if (speechState === "talking") {
		return {
			icon: AudioLinesIcon,
			tone: "success" as const,
			value: "Speaking",
		};
	}

	if (bodyState === "thinking") {
		return {
			icon: AudioLinesIcon,
			tone: "default" as const,
			value: "Replying soon",
		};
	}

	return {
		icon: AudioLinesIcon,
		tone: "default" as const,
		value: "Quiet",
	};
};

const AvatarStageHidden = ({ compact }: { compact: boolean }) => {
	return (
		<div
			className={cn(
				"flex h-full min-h-[18rem] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/70 bg-[linear-gradient(160deg,rgba(230,247,255,0.92),rgba(255,255,255,0.72))] px-6 py-8 text-center shadow-sm",
				compact && "min-h-[15rem] px-5 py-6",
			)}
		>
			<div className="flex size-12 items-center justify-center rounded-full border border-blue-200/80 bg-white/80 text-foreground shadow-sm">
				<EyeOffIcon className="size-5" />
			</div>
			<h3 className="mt-4 font-medium text-base">Avatar hidden</h3>
			<p className="mt-2 max-w-sm text-muted-foreground text-sm leading-6">
				The chat stays fully available. Turn the avatar back on from Settings
				whenever you want the live stage again.
			</p>
		</div>
	);
};

export const Assistant = () => {
	const runtime = useChatRuntime<AssistantChatUIMessage>({
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		transport: new AssistantChatTransport({
			api: "/api/chat",
		}),
	});

	const [emotionState, setEmotionState] = useState<EmotionState>("neutral");
	const [bodyState, setBodyState] = useState<BodyState>("idleDance");
	const [speechState, setSpeechState] = useState<SpeechState>("silent");
	const [stopSpeechRequest, setStopSpeechRequest] = useState(0);
	const [authSession, setAuthSession] = useState<AuthSessionState | null>(null);
	const [isAuthLoading, setIsAuthLoading] = useState(true);
	const [avatarStatus, setAvatarStatus] =
		useState<AvatarCanvasStatus>("loading");
	const [preferences, setPreferences] = useState<UserPreferences>(
		DEFAULT_USER_PREFERENCES,
	);
	const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
	const [activeView, setActiveView] = useState<ActiveView>("assistant");
	const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
	const previousVoiceEnabledRef = useRef(DEFAULT_USER_PREFERENCES.voiceEnabled);

	useEffect(() => {
		let isCancelled = false;

		const loadAuthSession = async () => {
			try {
				const response = await fetch("/api/auth/session", {
					cache: "no-store",
					credentials: "same-origin",
				});
				const body = (await response.json().catch(() => null)) as
					| AuthSessionResponse
					| { error?: string }
					| null;

				if (
					isCancelled ||
					!response.ok ||
					!body ||
					!("threadOwnerKey" in body)
				) {
					return;
				}

				setAuthSession({
					isAuthenticated: body.isAuthenticated,
					isAdmin: body.isAdmin,
					threadOwnerKey: body.threadOwnerKey,
					user: body.user,
				});
			} catch (error) {
				console.error("Failed to load the authentication session.", error);
			} finally {
				if (!isCancelled) {
					setIsAuthLoading(false);
				}
			}
		};

		void loadAuthSession();

		return () => {
			isCancelled = true;
		};
	}, []);

	useEffect(() => {
		const browserDefaults = getBrowserDefaultPreferences();
		const savedPreferences = parseUserPreferences(
			window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY),
			browserDefaults,
		);
		setPreferences(savedPreferences);
		previousVoiceEnabledRef.current = savedPreferences.voiceEnabled;
		setHasLoadedPreferences(true);
	}, []);

	useEffect(() => {
		if (!hasLoadedPreferences) {
			return;
		}

		window.localStorage.setItem(
			USER_PREFERENCES_STORAGE_KEY,
			serializeUserPreferences(preferences),
		);
	}, [hasLoadedPreferences, preferences]);

	useEffect(() => {
		if (previousVoiceEnabledRef.current && !preferences.voiceEnabled) {
			setStopSpeechRequest((current) => current + 1);
		}

		previousVoiceEnabledRef.current = preferences.voiceEnabled;
	}, [preferences.voiceEnabled]);

	useEffect(() => {
		if (
			!hasLoadedPreferences ||
			!authSession?.isAuthenticated ||
			!authSession.user
		) {
			return;
		}

		const savedAvatarId = readAvatarSelections()[authSession.user.id];
		if (savedAvatarId) {
			setPreferences((current) =>
				current.avatarId === savedAvatarId
					? current
					: {
							...current,
							avatarId: savedAvatarId,
						},
			);
			setAvatarPickerOpen(false);
			return;
		}

		setAvatarPickerOpen(true);
	}, [authSession, hasLoadedPreferences]);

	const selectAvatar = (avatarId: AvatarId) => {
		setPreferences((current) => ({
			...current,
			avatarId,
			avatarVisible: true,
		}));

		if (authSession?.isAuthenticated && authSession.user) {
			writeAvatarSelection(authSession.user.id, avatarId);
		}
	};

	const confirmAvatarSelection = () => {
		const avatarId = isAvatarId(preferences.avatarId)
			? preferences.avatarId
			: DEFAULT_AVATAR_ID;

		selectAvatar(avatarId);
		setAvatarPickerOpen(false);
	};

	const avatarRuntimeKey = preferences.reducedMotion
		? `${preferences.avatarId}:reduced-motion`
		: `${preferences.avatarId}:full-motion`;
	const selectedAvatar = getAvatarOption(preferences.avatarId);

	const avatarStatusModel = getAvatarStatusModel(
		avatarStatus,
		preferences.avatarVisible,
	);
	const sceneAvatarState =
		speechState === "talking"
			? "talking"
			: bodyState === "thinking"
				? "thinking"
				: emotionToAvatarState(emotionState);
	const voiceStatusModel = getVoiceStatusModel(
		speechState,
		bodyState,
		preferences.voiceEnabled,
	);
	const compactChat = preferences.compactChat;
	const showVoiceAction =
		preferences.voiceEnabled &&
		(speechState === "talking" || bodyState === "thinking");

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<div className="relative min-h-screen overflow-y-auto bg-sky-100 text-foreground lg:h-screen lg:overflow-hidden">
				<AppScene avatarState={sceneAvatarState} />
				<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(210,239,255,0.68)_0%,rgba(125,199,246,0.16)_48%,rgba(125,199,246,0)_100%)]" />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-[linear-gradient(0deg,rgba(219,238,255,0.82),rgba(219,238,255,0))]" />

				<div
					className={cn(
						"relative mx-auto flex min-h-screen w-full max-w-[92rem] flex-col gap-3 px-4 py-4 lg:h-full lg:min-h-0",
						compactChat && "gap-3 px-3.5 py-3.5",
					)}
				>
					<header
						className={cn(
							"flex shrink-0 flex-col gap-3 rounded-[28px] border border-white/75 bg-white/58 px-4 py-3 shadow-sm backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between",
							compactChat && "rounded-[24px] px-4 py-3",
						)}
					>
						<div className="flex min-w-0 items-center gap-3">
							<SiteLogoMark />
							<div className="min-w-0">
								<h1 className="truncate font-semibold text-blue-950 text-lg tracking-tight">
									Mango
								</h1>
								<p className="truncate text-blue-900/70 text-xs">
									Cute 3D chat companion
								</p>
							</div>
						</div>

						<div className="hidden min-w-0 items-center gap-2 rounded-full border border-white/75 bg-white/68 px-3 py-1.5 text-blue-900/72 text-xs shadow-sm md:flex">
							<span
								className={cn(
									"size-2 rounded-full",
									avatarStatusModel.tone === "success"
										? "bg-emerald-500"
										: avatarStatusModel.tone === "warning"
											? "bg-rose-400"
											: "bg-amber-400",
								)}
							/>
							<span className="font-medium text-blue-950">
								{avatarStatusModel.value}
							</span>
							<span className="text-blue-900/35">/</span>
							<span>{voiceStatusModel.value}</span>
						</div>

						<div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="rounded-full"
								onClick={() =>
									setActiveView((current) =>
										current === "dashboard" ? "assistant" : "dashboard",
									)
								}
							>
								{activeView === "dashboard" ? (
									<MessageCircleIcon className="size-4" />
								) : (
									<LayoutDashboardIcon className="size-4" />
								)}
								{activeView === "dashboard" ? "Chat" : "Dashboard"}
							</Button>
							<PreferencesDialog
								onChange={setPreferences}
								onReset={() => setPreferences(getBrowserDefaultPreferences())}
								preferences={preferences}
							/>
							<AccountControls
								isLoading={isAuthLoading}
								session={authSession}
								onSessionChange={setAuthSession}
							/>
						</div>
					</header>

					{activeView === "dashboard" ? (
						<UserDashboard
							session={authSession}
							selectedAvatarId={selectedAvatar.id}
							onAvatarSelect={selectAvatar}
						/>
					) : (
						<div
							className={cn(
								"grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)]",
								compactChat && "gap-3",
							)}
						>
							<section
								className={cn(
									"relative flex min-h-[28rem] flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white/28 p-3 shadow-[0_22px_70px_-36px_rgba(15,78,99,0.42)] backdrop-blur-xl sm:p-4",
									compactChat && "p-3",
								)}
							>
								<div className="min-h-0 flex-1">
									{preferences.avatarVisible ? (
										<AvatarCanvas
											key={avatarRuntimeKey}
											emotionState={emotionState}
											bodyState={bodyState}
											modelPath={selectedAvatar.modelPath}
											reducedMotion={preferences.reducedMotion}
											speechState={speechState}
											onStatusChange={setAvatarStatus}
										/>
									) : (
										<AvatarStageHidden compact={compactChat} />
									)}
								</div>

								<div className="absolute right-5 bottom-5 left-5 z-10 flex flex-wrap gap-2">
									<div className="rounded-full border border-white/70 bg-white/76 px-3 py-1.5 text-xs shadow-sm backdrop-blur-xl">
										<span className="font-medium text-blue-950">
											{selectedAvatar.name}
										</span>{" "}
										<span className="text-blue-900/45">/</span>{" "}
										<span className="font-medium text-blue-950">
											{bodyLabels[bodyState]}
										</span>
									</div>
									{showVoiceAction ? (
										<Button
											type="button"
											variant="secondary"
											size="sm"
											className="h-auto rounded-full px-3 py-1.5 text-xs"
											onClick={() =>
												setStopSpeechRequest((current) => current + 1)
											}
										>
											{speechState === "talking"
												? "Stop voice"
												: "Voice queued"}
										</Button>
									) : null}
								</div>
							</section>

							<section className="min-h-[30rem] overflow-hidden rounded-[26px] border border-white/70 bg-sky-50/66 shadow-[0_22px_70px_-34px_rgba(17,82,153,0.42)] backdrop-blur-2xl lg:min-h-0">
								<PersistentThread
									key={authSession?.threadOwnerKey ?? "thread-pending-session"}
									compact={compactChat}
									onUserSend={() => {
										setEmotionState("neutral");
										setBodyState("thinking");
										setSpeechState("silent");
									}}
									onEmotionStateChange={setEmotionState}
									onBodyStateChange={setBodyState}
									onSpeechStateChange={setSpeechState}
									reducedMotion={preferences.reducedMotion}
									stopSpeechRequest={stopSpeechRequest}
									storageOwnerKey={authSession?.threadOwnerKey ?? null}
									voiceEnabled={preferences.voiceEnabled}
								/>
							</section>
						</div>
					)}
				</div>

				<AvatarPickerDialog
					open={avatarPickerOpen}
					required
					selectedAvatarId={selectedAvatar.id}
					onSelect={selectAvatar}
					onOpenChange={(open) => {
						if (!open) {
							confirmAvatarSelection();
							return;
						}
						setAvatarPickerOpen(open);
					}}
				/>
			</div>
		</AssistantRuntimeProvider>
	);
};
