"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useState } from "react";
import { Thread } from "@/components/assistant-ui/thread";
import AvatarCanvas from "@/components/ui/avatar-canvas";
import { Button } from "@/components/ui/button";
import type { AvatarState, Emotion } from "@/lib/avatar-state";
import type { AssistantChatUIMessage } from "@/lib/chat-response";

export const Assistant = () => {
	const runtime = useChatRuntime<AssistantChatUIMessage>({
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		transport: new AssistantChatTransport({
			api: "/api/chat",
		}),
	});

	const [avatarState, setAvatarState] = useState<AvatarState>("idle");
	const [emotion, setEmotion] = useState<Emotion>("neutral");
	const [stopSpeechRequest, setStopSpeechRequest] = useState(0);

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<div className="h-screen overflow-hidden bg-background text-foreground">
				<div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4">
					<div className="shrink-0 flex justify-center pt-3 pb-2">
						<div className="relative w-full max-w-lg">
							<AvatarCanvas state={avatarState} emotion={emotion} />
							<div className="pointer-events-none absolute top-3 right-3">
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="pointer-events-auto rounded-full shadow-sm"
									disabled={avatarState === "idle"}
									onClick={() => setStopSpeechRequest((current) => current + 1)}
								>
									Stop voice
								</Button>
							</div>
						</div>
					</div>

					<div className="flex-1 min-h-0 overflow-hidden">
						<Thread
							onUserSend={() => {
								setEmotion("neutral");
								setAvatarState("thinking");
							}}
							onAvatarStateChange={setAvatarState}
							onEmotionChange={setEmotion}
							stopSpeechRequest={stopSpeechRequest}
						/>
					</div>
				</div>
			</div>
		</AssistantRuntimeProvider>
	);
};
