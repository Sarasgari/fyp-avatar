const STRONG_BOUNDARIES = new Set([".", "!", "?", ":", ";"]);
const SOFT_BOUNDARIES = new Set([",", "\n"]);

export const DEFAULT_MIN_TTS_CHUNK_LENGTH = 80;
export const INITIAL_TTS_CHUNK_LENGTH = 36;
const MIN_NATURAL_STRONG_CHUNK_LENGTH = 38;
const MIN_NATURAL_SOFT_CHUNK_LENGTH = 28;

export type ExtractSpeakableChunksOptions = {
	buffer: string;
	minChunkLength?: number;
	final?: boolean;
};

export type ExtractSpeakableChunksResult = {
	chunks: string[];
	remaining: string;
};

const collectBoundaryIndexes = (buffer: string) => {
	const strongIndexes: number[] = [];
	const softIndexes: number[] = [];

	for (let index = 0; index < buffer.length; index += 1) {
		const character = buffer[index];
		const nextCharacter = buffer[index + 1];

		if (character === "\n") {
			softIndexes.push(index + 1);
			continue;
		}

		if (
			STRONG_BOUNDARIES.has(character) &&
			(!nextCharacter || /\s/.test(nextCharacter))
		) {
			strongIndexes.push(index + 1);
			continue;
		}

		if (
			SOFT_BOUNDARIES.has(character) &&
			(!nextCharacter || /\s/.test(nextCharacter))
		) {
			softIndexes.push(index + 1);
		}
	}

	return { strongIndexes, softIndexes };
};

// Split streamed assistant text into chunks that are large enough to sound
// natural, while still allowing short complete sentences through quickly.
export const extractSpeakableChunks = ({
	buffer,
	minChunkLength = DEFAULT_MIN_TTS_CHUNK_LENGTH,
	final = false,
}: ExtractSpeakableChunksOptions): ExtractSpeakableChunksResult => {
	let remaining = buffer.trimStart();
	const chunks: string[] = [];

	while (remaining) {
		const { strongIndexes, softIndexes } = collectBoundaryIndexes(remaining);

		if (strongIndexes.length === 0 && softIndexes.length === 0) {
			if (final) {
				const tail = remaining.trim();
				if (tail) chunks.push(tail);
				remaining = "";
			}

			break;
		}

		const allIndexes = [...strongIndexes, ...softIndexes].sort((a, b) => a - b);
		const boundaryAtEnd =
			allIndexes[allIndexes.length - 1] === remaining.length;
		const preferredStrongBoundary = strongIndexes.find(
			(boundaryIndex) => boundaryIndex >= minChunkLength,
		);
		const preferredSoftBoundary = softIndexes.find(
			(boundaryIndex) =>
				boundaryIndex >=
				Math.max(MIN_NATURAL_SOFT_CHUNK_LENGTH, minChunkLength * 0.65),
		);

		let splitIndex: number | undefined =
			preferredStrongBoundary ?? preferredSoftBoundary;

		if (
			splitIndex === undefined &&
			boundaryAtEnd &&
			allIndexes[allIndexes.length - 1] >= MIN_NATURAL_STRONG_CHUNK_LENGTH
		) {
			splitIndex = allIndexes[allIndexes.length - 1];
		}

		if (
			splitIndex === undefined &&
			strongIndexes.length > 0 &&
			strongIndexes[strongIndexes.length - 1] >= MIN_NATURAL_STRONG_CHUNK_LENGTH
		) {
			splitIndex = strongIndexes[strongIndexes.length - 1];
		}

		if (
			splitIndex === undefined &&
			softIndexes.length > 0 &&
			softIndexes[softIndexes.length - 1] >=
				Math.max(MIN_NATURAL_SOFT_CHUNK_LENGTH, minChunkLength * 0.5)
		) {
			splitIndex = softIndexes[softIndexes.length - 1];
		}

		if (splitIndex === undefined && final) {
			splitIndex = allIndexes[allIndexes.length - 1];
		}

		if (splitIndex === undefined) {
			break;
		}

		const chunk = remaining.slice(0, splitIndex).trim();
		if (!chunk) {
			remaining = remaining.slice(splitIndex).trimStart();
			continue;
		}

		chunks.push(chunk);
		remaining = remaining.slice(splitIndex).trimStart();
	}

	return { chunks, remaining };
};
