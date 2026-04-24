export async function requestTTS(
  text: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("TTS text is required.");
  }

  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: trimmedText }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "TTS request failed." }));
    throw new Error(
      typeof errorBody?.error === "string"
        ? errorBody.error
        : "TTS request failed.",
    );
  }

  const audioBlob = await response.blob();

  if (audioBlob.size === 0) {
    throw new Error("TTS returned empty audio.");
  }

  return audioBlob;
}
