export type AvatarState = "idle" | "thinking" | "speaking";

type AvatarMessagePartLike = {
  type?: unknown;
  text?: unknown;
  audio?: unknown;
};

type ThreadMessageLike = {
  role?: string;
  content?: unknown;
  parts?: readonly AvatarMessagePartLike[];
};

const hasRenderableAssistantOutput = (
  message: ThreadMessageLike | undefined,
) => {
  if (!message) return false;

  if (typeof message.content === "string" && message.content.trim().length > 0) {
    return true;
  }

  if (!message.parts) return false;

  for (const part of message.parts) {
    if (!part || typeof part !== "object") continue;

    const partType = typeof part.type === "string" ? part.type : undefined;
    if (!partType) continue;

    if (
      (partType === "text" || partType === "reasoning") &&
      typeof part.text === "string" &&
      part.text.trim().length > 0
    ) {
      return true;
    }

    if (partType === "audio" && part.audio) {
      return true;
    }

    // Some assistant-ui message states surface running text/tool parts before
    // the final text field is populated. Treat any assistant part as output so
    // the avatar can visibly transition into speaking as soon as the turn starts.
    return true;
  }

  return false;
};

export const deriveAvatarState = ({
  isRunning,
  messages,
}: {
  isRunning: boolean;
  messages: readonly ThreadMessageLike[];
}): AvatarState => {
  if (!isRunning) return "idle";

  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.role !== "assistant") {
    return "thinking";
  }

  return hasRenderableAssistantOutput(lastMessage) ? "speaking" : "speaking";
};
