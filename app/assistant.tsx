"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useState } from "react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Thread } from "@/components/assistant-ui/thread";
import AvatarCanvas from "@/components/ui/avatar-canvas";
import type { AvatarState } from "@/lib/avatar-state";

export const Assistant = () => {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  const [avatarState, setAvatarState] = useState<AvatarState>("idle");

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-screen overflow-hidden bg-background text-foreground">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4">
          <div className="shrink-0 flex justify-center pt-3 pb-2">
            <div className="relative w-full max-w-lg">
              <AvatarCanvas state={avatarState} />
              <div className="absolute top-3 right-3 rounded-full border border-border/70 bg-background/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                {avatarState}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <Thread onAvatarStateChange={setAvatarState} />
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
};
