import type { AuthenticatedUser } from "../auth";
import { getClientIp } from "./api";
import type { RequestIdentity } from "./auth";

export type VisitorRecord = {
	id: string;
	sessionId: string;
	user: Pick<AuthenticatedUser, "id" | "email" | "name"> | null;
	ip: string;
	userAgent: string;
	referrer: string | null;
	path: string;
	firstSeenAt: string;
	lastSeenAt: string;
	visitCount: number;
};

const VISITORS_BY_SESSION = new Map<string, VisitorRecord>();
const MAX_VISITOR_RECORDS = 200;

const getRequestPath = (request: Request) => {
	const referer = request.headers.get("referer");
	if (referer) {
		try {
			const url = new URL(referer);
			return `${url.pathname}${url.search}` || "/";
		} catch {
			return referer.slice(0, 240);
		}
	}

	try {
		const url = new URL(request.url);
		return `${url.pathname}${url.search}` || "/";
	} catch {
		return "/";
	}
};

const pruneVisitors = () => {
	if (VISITORS_BY_SESSION.size <= MAX_VISITOR_RECORDS) {
		return;
	}

	const oldest = [...VISITORS_BY_SESSION.values()].sort((left, right) =>
		left.lastSeenAt.localeCompare(right.lastSeenAt),
	)[0];

	if (oldest) {
		VISITORS_BY_SESSION.delete(oldest.sessionId);
	}
};

export const recordVisitor = ({
	request,
	identity,
	now = new Date(),
}: {
	request: Request;
	identity: RequestIdentity;
	now?: Date;
}) => {
	if (!identity.ok) {
		return null;
	}

	const seenAt = now.toISOString();
	const existing = VISITORS_BY_SESSION.get(identity.sessionId);
	const user = identity.user
		? {
				id: identity.user.id,
				email: identity.user.email,
				name: identity.user.name,
			}
		: null;

	const nextRecord: VisitorRecord = {
		id: identity.sessionId,
		sessionId: identity.sessionId,
		user,
		ip: getClientIp(request),
		userAgent: (request.headers.get("user-agent") ?? "Unknown").slice(0, 240),
		referrer: request.headers.get("referer"),
		path: getRequestPath(request),
		firstSeenAt: existing?.firstSeenAt ?? seenAt,
		lastSeenAt: seenAt,
		visitCount: (existing?.visitCount ?? 0) + 1,
	};

	VISITORS_BY_SESSION.set(identity.sessionId, nextRecord);
	pruneVisitors();
	return nextRecord;
};

export const listVisitors = () =>
	[...VISITORS_BY_SESSION.values()].sort((left, right) =>
		right.lastSeenAt.localeCompare(left.lastSeenAt),
	);

export const resetVisitorStoreStateForTests = () => {
	VISITORS_BY_SESSION.clear();
};
