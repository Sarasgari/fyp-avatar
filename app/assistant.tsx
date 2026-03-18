"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Thread } from "@/components/assistant-ui/thread";

export const Assistant = () => {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh flex flex-col bg-background">
        <div className="flex justify-center px-4 pt-6 pb-4">
          <div className="flex h-[320px] w-full max-w-[280px] items-center justify-center rounded-2xl border bg-muted/40">
            Avatar area
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
};