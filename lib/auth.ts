export type AuthenticatedUser = {
	id: string;
	email: string;
	name: string;
	createdAt: string;
};

export type AuthSessionState = {
	user: AuthenticatedUser | null;
	isAuthenticated: boolean;
	isAdmin: boolean;
	threadOwnerKey: string;
};

export const getGuestThreadOwnerKey = (sessionId: string) =>
	`guest:${sessionId}`;

export const getUserThreadOwnerKey = (userId: string) => `user:${userId}`;

export const getThreadOwnerKeyForIdentity = ({
	sessionId,
	userId,
}: {
	sessionId: string;
	userId?: string | null;
}) =>
	userId ? getUserThreadOwnerKey(userId) : getGuestThreadOwnerKey(sessionId);

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const normalizeDisplayName = (value: string) =>
	value.trim().replace(/\s+/g, " ");
