export type TimedWordBoundary = {
	endIndex: number;
	endTime: number;
};

const WORD_TOKEN_REGEX = /\S+\s*/g;

const getTokenWeight = (token: string) => {
	const normalizedWord = token.replace(/[^A-Za-z0-9']/g, "");
	const baseWeight = Math.max(0.9, normalizedWord.length * 0.16 + 0.55);

	if (/[.?!]$/.test(token)) return baseWeight + 0.9;
	if (/[,;:]$/.test(token)) return baseWeight + 0.45;
	return baseWeight;
};

export const appendTranscriptChunk = (base: string, chunk: string) => {
	const trimmedChunk = chunk.trim();
	if (!trimmedChunk) return base;
	if (!base) return trimmedChunk;

	const needsSpace =
		!/[\s([{/"'`-]$/.test(base) && !/^[,.;:!?)]/.test(trimmedChunk);

	return needsSpace ? `${base} ${trimmedChunk}` : `${base}${trimmedChunk}`;
};

export const buildTimedWordBoundaries = (
	text: string,
	duration: number,
): TimedWordBoundary[] => {
	const matches = Array.from(text.matchAll(WORD_TOKEN_REGEX));
	if (matches.length === 0 || duration <= 0) return [];

	const totalWeight = matches.reduce(
		(sum, match) => sum + getTokenWeight(match[0]),
		0,
	);

	let elapsedWeight = 0;

	return matches.map((match) => {
		elapsedWeight += getTokenWeight(match[0]);

		return {
			endIndex: (match.index ?? 0) + match[0].length,
			endTime: (elapsedWeight / totalWeight) * duration,
		};
	});
};

export const getRevealTextForTime = (
	text: string,
	boundaries: TimedWordBoundary[],
	currentTime: number,
	duration: number,
) => {
	if (boundaries.length === 0) {
		return currentTime >= duration * 0.9 ? text : "";
	}

	let endIndex = 0;

	for (const boundary of boundaries) {
		if (currentTime >= boundary.endTime) {
			endIndex = boundary.endIndex;
			continue;
		}

		break;
	}

	return text.slice(0, endIndex);
};
