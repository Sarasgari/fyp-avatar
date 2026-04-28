const RETRYABLE_STATUS_CODES = new Set([
	408, 409, 425, 429, 500, 502, 503, 504,
]);
const MAX_TTS_ATTEMPTS = 2;

const delay = (ms: number) =>
	new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export async function requestTTS(
	text: string,
	signal?: AbortSignal,
): Promise<Blob> {
	const trimmedText = text.trim();

	if (!trimmedText) {
		throw new Error("TTS text is required.");
	}

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= MAX_TTS_ATTEMPTS; attempt += 1) {
		try {
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
				const errorMessage =
					typeof errorBody?.error === "string"
						? errorBody.error
						: "TTS request failed.";
				const error = new Error(errorMessage);

				if (
					attempt < MAX_TTS_ATTEMPTS &&
					RETRYABLE_STATUS_CODES.has(response.status)
				) {
					lastError = error;
					await delay(160 * attempt);
					continue;
				}

				throw error;
			}

			const audioBlob = await response.blob();

			if (audioBlob.size === 0) {
				throw new Error("TTS returned empty audio.");
			}

			return audioBlob;
		} catch (error) {
			if ((error as DOMException)?.name === "AbortError") {
				throw error;
			}

			lastError =
				error instanceof Error ? error : new Error("TTS request failed.");

			if (attempt < MAX_TTS_ATTEMPTS) {
				await delay(160 * attempt);
			}
		}
	}

	throw lastError ?? new Error("TTS request failed.");
}
