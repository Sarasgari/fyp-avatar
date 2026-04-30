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
	EyeOffIcon,
	LoaderCircleIcon,
	type LucideIcon,
	ShieldCheckIcon,
	SparklesIcon,
	TriangleAlertIcon,
	VolumeXIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PersistentThread } from "@/components/assistant-ui/persistent-thread";
import { AccountControls } from "@/components/auth/account-controls";
import { PreferencesDialog } from "@/components/preferences/preferences-dialog";
import AvatarCanvas, {
	type AvatarCanvasStatus,
} from "@/components/ui/avatar-canvas";
import { Button } from "@/components/ui/button";
import type { AuthSessionState } from "@/lib/auth";
import type { BodyState, EmotionState, SpeechState } from "@/lib/avatar-state";
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
		"border-white/55 bg-white/58 text-foreground shadow-sm backdrop-blur-xl",
	success:
		"border-lime-200/80 bg-lime-100/90 text-lime-950 shadow-sm backdrop-blur-xl",
	warning:
		"border-amber-200/90 bg-amber-100/90 text-amber-950 shadow-sm backdrop-blur-xl",
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
				"flex h-full min-h-[18rem] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/60 bg-[linear-gradient(160deg,rgba(255,244,214,0.9),rgba(255,255,255,0.72))] px-6 py-8 text-center shadow-sm",
				compact && "min-h-[15rem] px-5 py-6",
			)}
		>
			<div className="flex size-12 items-center justify-center rounded-full border border-orange-200/80 bg-white/80 text-foreground shadow-sm">
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
	const voiceStatusModel = getVoiceStatusModel(
		speechState,
		bodyState,
		preferences.voiceEnabled,
	);
	const storageStatusModel = getStorageStatusModel(authSession, isAuthLoading);
	const compactChat = preferences.compactChat;

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<div className="relative h-screen overflow-hidden bg-[linear-gradient(128deg,#ffdcb2_0%,#ffad8d_34%,#fb4a3d_100%)] text-foreground">
				<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,246,218,0.62)_0%,rgba(255,166,126,0.18)_44%,rgba(138,45,35,0.26)_100%)]" />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(0deg,rgba(255,236,177,0.72),rgba(255,236,177,0))]" />

				<div
					className={cn(
						"relative mx-auto flex h-full w-full max-w-[86rem] flex-col gap-4 px-4 py-4",
						compactChat && "gap-3 px-3.5 py-3.5",
					)}
				>
					<header
						className={cn(
							"rounded-full border border-white/60 bg-white/74 px-5 py-3 shadow-[0_18px_60px_-32px_rgba(75,28,20,0.55)] backdrop-blur-xl sm:px-6",
							compactChat && "px-4 py-4 sm:px-5",
						)}
					>
						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div className="min-w-0">
								<div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50/80 px-3 py-1 text-muted-foreground text-xs shadow-sm">
									<BotIcon className="size-3.5" />
									Avatar assistant
								</div>
								<h1 className="mt-2 max-w-3xl font-semibold text-2xl text-[#4a2119] tracking-tight text-balance sm:text-3xl">
									Your expressive AI companion, live on stage.
								</h1>
								<p className="mt-1 max-w-2xl text-[#6f4a43] text-sm leading-6">
									Chat, listen, and watch the avatar react with mood, posture,
									and voice cues.
								</p>
							</div>

							<div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
						</div>

						<div className="mt-3 flex flex-wrap gap-2">
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
								icon={SparklesIcon}
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
					</header>

					<div
						className={cn(
							"grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]",
							compactChat && "gap-3",
						)}
					>
						<section
							className={cn(
								"flex min-h-[22rem] flex-col rounded-[32px] border border-white/45 bg-white/32 p-4 shadow-[0_22px_70px_-36px_rgba(77,28,21,0.55)] backdrop-blur-xl sm:p-5",
								compactChat && "p-3.5 sm:p-4",
							)}
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<h2 className="font-medium text-[#4a2119] text-base">
										Avatar stage
									</h2>
									<p className="mt-1 text-[#6f4a43] text-sm leading-6">
										Live facial mood, posture, and speech cues stay in sync.
									</p>
								</div>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="rounded-full bg-white/72 shadow-sm hover:bg-white/88"
									disabled={
										!preferences.voiceEnabled ||
										(speechState === "silent" && bodyState === "idleDance")
									}
									onClick={() => setStopSpeechRequest((current) => current + 1)}
								>
									{!preferences.voiceEnabled
										? "Voice muted"
										: speechState === "talking"
											? "Stop voice"
											: "Voice idle"}
								</Button>
							</div>

							<div className="mt-4 min-h-0 flex-1">
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

							<div className="mt-4 grid gap-2 sm:grid-cols-2">
								<div className="rounded-2xl border border-white/45 bg-white/56 px-4 py-3 backdrop-blur">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
										Posture
									</p>
									<p className="mt-1 font-medium text-sm">
										{bodyLabels[bodyState]}
									</p>
								</div>
								<div className="rounded-2xl border border-white/45 bg-white/56 px-4 py-3 backdrop-blur">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
										Voice flow
									</p>
									<p className="mt-1 font-medium text-sm">
										{!preferences.voiceEnabled
											? "Muted in settings."
											: speechState === "talking"
												? "Audio is playing now."
												: bodyState === "thinking"
													? "Voice will start after the reply arrives."
													: "Waiting for the next turn."}
									</p>
								</div>
							</div>
						</section>

						<section className="min-h-0 overflow-hidden rounded-[32px] border border-white/55 bg-white/78 shadow-[0_22px_70px_-34px_rgba(77,28,21,0.58)] backdrop-blur-xl">
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
