export type AvatarOption = {
	id: string;
	name: string;
	description: string;
	modelPath: string;
	accentClass: string;
};

export const AVATAR_OPTIONS = [
	{
		id: "cool-toaster",
		name: "Cool Toaster",
		description: "A bright, playful companion with a gadgety personality.",
		modelPath: "/models/CoolToaster.vrm",
		accentClass: "from-sky-200 to-blue-500",
	},
	{
		id: "joker-dude",
		name: "Joker Dude",
		description: "Expressive, bold, and made for lively conversations.",
		modelPath: "/models/JokerDude.vrm",
		accentClass: "from-lime-200 to-emerald-500",
	},
	{
		id: "agnes",
		name: "Agnes",
		description: "Warm, steady, and easy to spend time with.",
		modelPath: "/models/Agnes.vrm",
		accentClass: "from-rose-200 to-pink-500",
	},
	{
		id: "juanita",
		name: "Juanita",
		description: "Friendly, confident, and ready for focused chats.",
		modelPath: "/models/Juanita.vrm",
		accentClass: "from-amber-200 to-orange-500",
	},
	{
		id: "leaf-boy",
		name: "Leaf Boy",
		description: "Soft, curious, and a little nature-inspired.",
		modelPath: "/models/LeafBoy.vrm",
		accentClass: "from-green-200 to-teal-500",
	},
	{
		id: "vladi",
		name: "Vladi",
		description: "Calm, characterful, and quietly memorable.",
		modelPath: "/models/Vladi.vrm",
		accentClass: "from-indigo-200 to-violet-500",
	},
	{
		id: "summer-v2",
		name: "Summer",
		description: "Sunny, upbeat, and relaxed.",
		modelPath: "/models/Summer_V2.vrm",
		accentClass: "from-yellow-200 to-cyan-500",
	},
] as const satisfies readonly AvatarOption[];

export type AvatarId = (typeof AVATAR_OPTIONS)[number]["id"];

export const DEFAULT_AVATAR_ID: AvatarId = "cool-toaster";

export const isAvatarId = (value: string): value is AvatarId =>
	AVATAR_OPTIONS.some((avatar) => avatar.id === value);

export const getAvatarOption = (avatarId: string | null | undefined) =>
	AVATAR_OPTIONS.find((avatar) => avatar.id === avatarId) ??
	AVATAR_OPTIONS.find((avatar) => avatar.id === DEFAULT_AVATAR_ID) ??
	AVATAR_OPTIONS[0];
