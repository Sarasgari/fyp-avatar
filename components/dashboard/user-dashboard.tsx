"use client";

import {
	ActivityIcon,
	CalendarDaysIcon,
	Globe2Icon,
	LayoutDashboardIcon,
	MessageSquareTextIcon,
	PaletteIcon,
	RefreshCwIcon,
	SparklesIcon,
	UserRoundIcon,
	UsersRoundIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AvatarPickerGrid } from "@/components/avatar/avatar-picker";
import AvatarCanvas from "@/components/ui/avatar-canvas";
import { Button } from "@/components/ui/button";
import type { AuthSessionState } from "@/lib/auth";
import { type AvatarId, getAvatarOption } from "@/lib/avatar-catalog";
import {
	getPersistedThreadStorageKey,
	parsePersistedThreadSnapshot,
} from "@/lib/thread-persistence";
import { cn } from "@/lib/utils";

type UserDashboardProps = {
	session: AuthSessionState | null;
	selectedAvatarId: AvatarId;
	onAvatarSelect: (avatarId: AvatarId) => void;
};

type VisitorRecord = {
	id: string;
	user: {
		id: string;
		email: string;
		name: string;
	} | null;
	ip: string;
	userAgent: string;
	path: string;
	firstSeenAt: string;
	lastSeenAt: string;
	visitCount: number;
};

type DashboardPanel = "overview" | "characters" | "visitors";

type MetricCardProps = {
	icon: typeof UserRoundIcon;
	label: string;
	value: string | number;
	tone: "blue" | "rose" | "emerald" | "amber";
};

const metricToneClasses: Record<MetricCardProps["tone"], string> = {
	blue: "border-sky-200/80 bg-sky-50/84 text-sky-950",
	rose: "border-rose-200/80 bg-rose-50/84 text-rose-950",
	emerald: "border-emerald-200/80 bg-emerald-50/84 text-emerald-950",
	amber: "border-amber-200/80 bg-amber-50/84 text-amber-950",
};

const MetricCard = ({ icon: Icon, label, value, tone }: MetricCardProps) => (
	<div
		className={cn(
			"rounded-2xl border p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5",
			metricToneClasses[tone],
		)}
	>
		<Icon className="size-5" />
		<div className="mt-3 text-xs opacity-70">{label}</div>
		<div className="mt-1 truncate font-semibold text-lg">{value}</div>
	</div>
);

const formatDate = (value: string | undefined) => {
	if (!value) {
		return "Guest mode";
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
	}).format(new Date(value));
};

const readMessageCount = (ownerKey: string | null | undefined) => {
	if (!ownerKey) {
		return 0;
	}

	const snapshot = parsePersistedThreadSnapshot(
		window.localStorage.getItem(getPersistedThreadStorageKey(ownerKey)),
	);
	return snapshot?.snapshot.messages.length ?? 0;
};

export const UserDashboard = ({
	session,
	selectedAvatarId,
	onAvatarSelect,
}: UserDashboardProps) => {
	const selectedAvatar = getAvatarOption(selectedAvatarId);
	const [messageCount, setMessageCount] = useState(0);
	const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
	const [isLoadingVisitors, setIsLoadingVisitors] = useState(false);
	const [visitorError, setVisitorError] = useState<string | null>(null);
	const [activePanel, setActivePanel] = useState<DashboardPanel>("overview");
	const isAuthenticated = Boolean(session?.isAuthenticated && session.user);
	const isAdmin = Boolean(session?.isAdmin);
	const displayName = isAuthenticated
		? (session?.user?.name ?? "Friend")
		: "Guest";
	const recentVisitors = visitors.slice(0, 4);

	useEffect(() => {
		setMessageCount(readMessageCount(session?.threadOwnerKey));
	}, [session?.threadOwnerKey]);

	const loadVisitors = useCallback(async () => {
		if (!isAdmin) {
			return;
		}

		setIsLoadingVisitors(true);
		setVisitorError(null);

		try {
			const response = await fetch("/api/admin/visitors", {
				cache: "no-store",
				credentials: "same-origin",
			});
			const body = (await response.json().catch(() => null)) as {
				visitors?: VisitorRecord[];
				error?: string;
			} | null;

			if (!response.ok) {
				throw new Error(body?.error ?? "Could not load visitors.");
			}

			setVisitors(Array.isArray(body?.visitors) ? body.visitors : []);
		} catch (error) {
			setVisitorError(
				error instanceof Error ? error.message : "Could not load visitors.",
			);
		} finally {
			setIsLoadingVisitors(false);
		}
	}, [isAdmin]);

	useEffect(() => {
		void loadVisitors();
	}, [loadVisitors]);

	return (
		<div className="relative min-h-0 flex-1 overflow-y-auto rounded-[30px] border border-white/65 bg-white/56 p-4 shadow-sm backdrop-blur-xl">
			<div className="flex flex-col gap-4 border-white/70 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
				<div className="min-w-0">
					<div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/68 px-3 py-1 text-blue-900/75 text-xs shadow-sm">
						<SparklesIcon className="size-3.5 text-rose-500" />
						Welcome back, {displayName}
					</div>
					<h2 className="mt-3 font-semibold text-2xl text-blue-950 tracking-tight">
						Mango dashboard
					</h2>
					<p className="mt-1 max-w-2xl text-blue-900/70 text-sm">
						Your avatar, chat memory, and account activity in one clean space.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{[
						{
							id: "overview" as const,
							label: "Overview",
							icon: LayoutDashboardIcon,
						},
						{
							id: "characters" as const,
							label: "Characters",
							icon: PaletteIcon,
						},
					].map((tab) => (
						<Button
							key={tab.id}
							type="button"
							size="sm"
							variant={activePanel === tab.id ? "default" : "outline"}
							className="rounded-full"
							onClick={() => setActivePanel(tab.id)}
						>
							<tab.icon className="size-4" />
							{tab.label}
						</Button>
					))}
					{isAdmin ? (
						<Button
							type="button"
							size="sm"
							variant={activePanel === "visitors" ? "default" : "outline"}
							className="rounded-full"
							onClick={() => setActivePanel("visitors")}
						>
							<UsersRoundIcon className="size-4" />
							Visitors
						</Button>
					) : null}
				</div>
			</div>

			{activePanel === "overview" ? (
				<div className="mt-4 grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
						<MetricCard
							icon={UserRoundIcon}
							label="Account"
							tone="blue"
							value={
								isAuthenticated ? (session?.user?.name ?? "User") : "Guest"
							}
						/>
						<MetricCard
							icon={CalendarDaysIcon}
							label="Joined"
							tone="rose"
							value={formatDate(session?.user?.createdAt)}
						/>
						<MetricCard
							icon={PaletteIcon}
							label="Current avatar"
							tone="emerald"
							value={selectedAvatar.name}
						/>
						<MetricCard
							icon={MessageSquareTextIcon}
							label="Saved messages"
							tone="amber"
							value={messageCount}
						/>
					</div>

					<section className="min-w-0 rounded-[28px] border border-white/75 bg-white/70 p-4 shadow-sm backdrop-blur">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0">
								<div className="text-blue-900/65 text-xs">Active character</div>
								<h3 className="truncate font-semibold text-blue-950 text-xl">
									{selectedAvatar.name}
								</h3>
								<p className="mt-1 text-blue-900/70 text-sm">
									{selectedAvatar.description}
								</p>
							</div>
							<Button
								type="button"
								className="rounded-full"
								onClick={() => setActivePanel("characters")}
							>
								<PaletteIcon className="size-4" />
								Choose avatar
							</Button>
						</div>
						<div className="mt-4 h-[22rem] overflow-hidden rounded-[24px]">
							<AvatarCanvas
								bodyState="idleDance"
								emotionState="happy"
								modelPath={selectedAvatar.modelPath}
								reducedMotion={false}
								speechState="silent"
							/>
						</div>
					</section>

					<aside className="rounded-[28px] border border-white/75 bg-white/66 p-4 shadow-sm backdrop-blur">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600">
								<ActivityIcon className="size-5" />
							</div>
							<div>
								<h3 className="font-semibold text-blue-950">Activity</h3>
								<p className="text-blue-900/65 text-xs">
									Your latest app signals.
								</p>
							</div>
						</div>

						<div className="mt-4 space-y-3">
							<div className="rounded-2xl border border-white/80 bg-white/72 p-3">
								<div className="text-blue-900/65 text-xs">Chat memory</div>
								<div className="mt-1 font-semibold text-blue-950">
									{messageCount} saved messages
								</div>
							</div>
							<div className="rounded-2xl border border-white/80 bg-white/72 p-3">
								<div className="text-blue-900/65 text-xs">Session type</div>
								<div className="mt-1 font-semibold text-blue-950">
									{isAuthenticated ? "Account sync" : "Guest mode"}
								</div>
							</div>
							{isAdmin ? (
								<button
									type="button"
									className="w-full rounded-2xl border border-amber-200/80 bg-amber-50/84 p-3 text-left text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_3px_0_rgba(245,158,11,0.2),0_12px_22px_-18px_rgba(146,64,14,0.44)] transition-transform hover:-translate-y-px active:translate-y-0.5"
									onClick={() => setActivePanel("visitors")}
								>
									<div className="flex items-center justify-between gap-3">
										<span>
											<span className="block text-xs opacity-70">
												Website visitors
											</span>
											<span className="mt-1 block font-semibold">
												{visitors.length} recorded sessions
											</span>
										</span>
									</div>
								</button>
							) : null}
						</div>

						{isAdmin && recentVisitors.length > 0 ? (
							<div className="mt-4">
								<div className="mb-2 text-blue-900/65 text-xs">
									Recent visitors
								</div>
								<div className="space-y-2">
									{recentVisitors.map((visitor) => (
										<div
											key={visitor.id}
											className="rounded-xl border border-white/80 bg-white/66 px-3 py-2 text-xs"
										>
											<div className="truncate font-medium text-blue-950">
												{visitor.user?.name ?? "Guest visitor"}
											</div>
											<div className="truncate text-blue-900/62">
												{visitor.user?.email ?? visitor.ip}
											</div>
										</div>
									))}
								</div>
							</div>
						) : null}
					</aside>
				</div>
			) : null}

			{activePanel === "characters" ? (
				<section className="mt-4">
					<div className="mb-3">
						<div>
							<h3 className="font-semibold text-blue-950 text-xl">
								Character studio
							</h3>
							<p className="mt-1 text-blue-900/70 text-sm">
								Hover or focus a character to preview the real 3D model, then
								choose the one you want.
							</p>
						</div>
					</div>
					<AvatarPickerGrid
						selectedAvatarId={selectedAvatarId}
						onSelect={onAvatarSelect}
					/>
				</section>
			) : null}

			{activePanel === "visitors" && isAdmin ? (
				<section className="mt-4 rounded-[28px] border border-white/70 bg-white/68 p-4 shadow-sm">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
								<Globe2Icon className="size-5" />
							</div>
							<div>
								<h3 className="font-semibold text-blue-950 text-lg">
									Website visitors
								</h3>
								<p className="mt-1 text-blue-900/70 text-sm">
									Recent sessions that opened the app in this running server.
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							disabled={isLoadingVisitors}
							onClick={() => void loadVisitors()}
						>
							<RefreshCwIcon
								className={isLoadingVisitors ? "size-4 animate-spin" : "size-4"}
							/>
							Refresh
						</Button>
					</div>

					{visitorError ? (
						<p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm">
							{visitorError}
						</p>
					) : null}

					<div className="mt-4 overflow-hidden rounded-xl border border-white/70">
						<div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.5fr] bg-blue-50/80 px-3 py-2 font-medium text-blue-950 text-xs">
							<span>Visitor</span>
							<span>Last seen</span>
							<span>Page</span>
							<span className="text-right">Visits</span>
						</div>
						<div className="max-h-72 overflow-y-auto bg-white/60">
							{visitors.length > 0 ? (
								visitors.map((visitor) => (
									<div
										key={visitor.id}
										className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.5fr] gap-2 border-white/70 border-t px-3 py-2 text-xs"
									>
										<div className="min-w-0">
											<div className="truncate font-medium text-blue-950">
												{visitor.user?.name ?? "Guest visitor"}
											</div>
											<div className="truncate text-blue-900/62">
												{visitor.user?.email ?? visitor.ip}
											</div>
										</div>
										<div className="text-blue-900/75">
											{new Intl.DateTimeFormat(undefined, {
												dateStyle: "short",
												timeStyle: "short",
											}).format(new Date(visitor.lastSeenAt))}
										</div>
										<div className="truncate text-blue-900/75">
											{visitor.path}
										</div>
										<div className="text-right font-medium text-blue-950">
											{visitor.visitCount}
										</div>
									</div>
								))
							) : (
								<div className="px-3 py-6 text-center text-blue-900/70 text-sm">
									No visitors recorded yet.
								</div>
							)}
						</div>
					</div>
				</section>
			) : null}
		</div>
	);
};
