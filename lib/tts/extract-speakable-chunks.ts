const SENTENCE_BOUNDARIES = new Set([".", "!", "?", ":", ";"]);

export const DEFAULT_MIN_TTS_CHUNK_LENGTH = 100;
const MIN_NATURAL_SENTENCE_LENGTH = 60;

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
  const indexes: number[] = [];

  for (let index = 0; index < buffer.length; index += 1) {
    const character = buffer[index];
    const nextCharacter = buffer[index + 1];

    if (character === "\n") {
      indexes.push(index + 1);
      continue;
    }

    if (
      SENTENCE_BOUNDARIES.has(character) &&
      (!nextCharacter || /\s/.test(nextCharacter))
    ) {
      indexes.push(index + 1);
    }
  }

  return indexes;
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
    const boundaryIndexes = collectBoundaryIndexes(remaining);

    if (boundaryIndexes.length === 0) {
      if (final) {
        const tail = remaining.trim();
        if (tail) chunks.push(tail);
        remaining = "";
      }

      break;
    }

    const boundaryAtEnd =
      boundaryIndexes[boundaryIndexes.length - 1] === remaining.length;
    const preferredBoundary = boundaryIndexes.find(
      (boundaryIndex) => boundaryIndex >= minChunkLength,
    );

    let splitIndex: number | undefined = preferredBoundary;

    if (
      splitIndex === undefined &&
      boundaryAtEnd &&
      boundaryIndexes[boundaryIndexes.length - 1] >= MIN_NATURAL_SENTENCE_LENGTH
    ) {
      splitIndex = boundaryIndexes[boundaryIndexes.length - 1];
    }

    if (splitIndex === undefined && final) {
      splitIndex = boundaryIndexes[boundaryIndexes.length - 1];
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
