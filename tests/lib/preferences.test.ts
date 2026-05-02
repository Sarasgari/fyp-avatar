import assert from "node:assert/strict";
import {
	coerceUserPreferences,
	DEFAULT_USER_PREFERENCES,
	parseUserPreferences,
	serializeUserPreferences,
} from "../../lib/preferences";

const run = (name: string, assertion: () => void) => {
	try {
		assertion();
		console.log(`ok - ${name}`);
	} catch (error) {
		console.error(`not ok - ${name}`);
		throw error;
	}
};

export const runPreferencesTests = async () => {
	run("serializeUserPreferences round-trips valid preferences", () => {
		const preferences = parseUserPreferences(
			serializeUserPreferences({
				voiceEnabled: false,
				avatarVisible: true,
				reducedMotion: true,
				compactChat: true,
				avatarId: "agnes",
			}),
		);

		assert.deepEqual(preferences, {
			voiceEnabled: false,
			avatarVisible: true,
			reducedMotion: true,
			compactChat: true,
			avatarId: "agnes",
		});
	});

	run("parseUserPreferences falls back to defaults for invalid JSON", () => {
		assert.deepEqual(
			parseUserPreferences("{not-json"),
			DEFAULT_USER_PREFERENCES,
		);
	});

	run("coerceUserPreferences merges partial values with defaults", () => {
		assert.deepEqual(
			coerceUserPreferences(
				{
					voiceEnabled: false,
					reducedMotion: true,
				},
				{
					voiceEnabled: true,
					avatarVisible: false,
					reducedMotion: false,
					compactChat: true,
					avatarId: "vladi",
				},
			),
			{
				voiceEnabled: false,
				avatarVisible: false,
				reducedMotion: true,
				compactChat: true,
				avatarId: "vladi",
			},
		);
	});
};
