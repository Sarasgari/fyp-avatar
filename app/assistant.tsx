"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import {
	AudioLinesIcon,
	BotIcon,
	BrainIcon,
	EyeOffIcon,
	LoaderCircleIcon,
	type LucideIcon,
	ShieldCheckIcon,
	TriangleAlertIcon,
	VolumeXIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PersistentThread } from "@/components/assistant-ui/persistent-thread";
import { AccountControls } from "@/components/auth/account-controls";
import { PreferencesDialog } from "@/components/preferences/preferences-dialog";
import AppScene from "@/components/scene/app-scene";
import AvatarCanvas, {
	type AvatarCanvasStatus,
} from "@/components/ui/avatar-canvas";
import { Button } from "@/components/ui/button";
import type { AuthSessionState } from "@/lib/auth";
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
	USER_PREFERENCES_STORAGE_KEY,
	type UserPreferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

type AuthSessionResponse = AuthSessionState & {
	requestId: string;
};

type StatusPillTone = "default" | "success" | "warning";

type StatusPillProps = {
	icon: LucideIcon;
	label: string;
	tone?: StatusPillTone;
	value: string;
	animate?: boolean;
};

const emotionLabels: Record<EmotionState, string> = {
	neutral: "Calm",
	happy: "Warm",
	sad: "Gentle",
	anxious: "Careful",
	angry: "Firm",
	confused: "Curious",
	empathetic: "Supportive",
};

const bodyLabels: Record<BodyState, string> = {
	idleDance: "Idle groove",
	thinking: "Thinking pose",
	sadPose: "Reflective pose",
	listening: "Listening pose",
	wave: "Greeting pose",
	celebration: "Celebration pose",
	dance: "Dance pose",
};

const statusPillToneClasses: Record<StatusPillTone, string> = {
	default:
		"border-white/65 bg-white/58 text-sky-950 shadow-sm backdrop-blur-xl",
	success:
		"border-blue-200/85 bg-blue-50/92 text-blue-950 shadow-sm backdrop-blur-xl",
	warning:
		"border-red-200/90 bg-red-50/92 text-red-950 shadow-sm backdrop-blur-xl",
};

const getBrowserDefaultPreferences = (): UserPreferences => ({
	...DEFAULT_USER_PREFERENCES,
	reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
});

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

const getStorageStatusModel = (
	session: AuthSessionState | null,
	isAuthLoading: boolean,
) => {
	if (isAuthLoading) {
		return {
			tone: "default" as const,
			value: "Checking session",
		};
	}

	if (session?.isAuthenticated) {
		return {
			tone: "success" as const,
			value: "Account sync",
		};
	}

	return {
		tone: "default" as const,
		value: "Session-only history",
	};
};

const StatusPill = ({
	icon: Icon,
	label,
	tone = "default",
	value,
	animate = false,
}: StatusPillProps) => {
	return (
		<div
			className={cn(
				"inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5",
				statusPillToneClasses[tone],
			)}
		>
			<Icon className={cn("size-3.5 shrink-0", animate && "animate-spin")} />
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="truncate font-medium text-xs">{value}</span>
		</div>
	);
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

	const avatarRuntimeKey = preferences.reducedMotion
		? "reduced-motion"
		: "full-motion";

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
	const storageStatusModel = getStorageStatusModel(authSession, isAuthLoading);
	const compactChat = preferences.compactChat;

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
							"flex shrink-0 flex-col gap-3 rounded-[30px] border border-white/75 bg-sky-50/64 px-4 py-3 shadow-[0_18px_60px_-32px_rgba(17,82,153,0.48)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between lg:rounded-full",
							compactChat && "rounded-[24px] px-4 py-3",
						)}
					>
						<div className="flex min-w-0 items-center gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/75 bg-white/80 shadow-sm">
								<BotIcon className="size-5 text-blue-700" />
							</div>
							<div className="min-w-0">
								<h1 className="truncate font-semibold text-blue-950 text-lg tracking-tight">
									Avatar Assistant
								</h1>
								<p className="truncate text-blue-900/70 text-xs">
									Clean 3D room, live voice, saved chat
								</p>
							</div>
						</div>

						<div className="flex min-w-0 flex-wrap gap-2 lg:justify-center">
							<StatusPill
								icon={avatarStatusModel.icon}
								label="Avatar"
								tone={avatarStatusModel.tone}
								value={avatarStatusModel.value}
								animate={avatarStatus === "loading"}
							/>
							<StatusPill
								icon={voiceStatusModel.icon}
								label="Voice"
								tone={voiceStatusModel.tone}
								value={voiceStatusModel.value}
							/>
							<StatusPill
								icon={BrainIcon}
								label="Mood"
								value={emotionLabels[emotionState]}
							/>
							<StatusPill
								icon={ShieldCheckIcon}
								label="Storage"
								tone={storageStatusModel.tone}
								value={storageStatusModel.value}
							/>
						</div>

						<div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
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
									<span className="text-blue-900/58">Posture</span>{" "}
									<span className="font-medium text-blue-950">
										{bodyLabels[bodyState]}
									</span>
								</div>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="h-auto rounded-full border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(219,234,254,0.78))] px-3 py-1.5 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_7px_0_-5px_rgba(96,165,250,0.56),0_16px_30px_-24px_rgba(17,82,153,0.62)] backdrop-blur-xl hover:bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(191,219,254,0.82))]"
									disabled={
										!preferences.voiceEnabled ||
										(speechState === "silent" && bodyState === "idleDance")
									}
									onClick={() => setStopSpeechRequest((current) => current + 1)}
								>
									<span className="text-blue-900/58">Voice</span>{" "}
									<span className="font-medium text-blue-950">
										{!preferences.voiceEnabled
											? "Muted"
											: speechState === "talking"
												? "Stop"
												: bodyState === "thinking"
													? "Queued"
													: "Quiet"}
									</span>
								</Button>
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
				</div>
			</div>
		</AssistantRuntimeProvider>
	);
};
