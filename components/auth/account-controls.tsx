"use client";

import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AuthSessionState } from "@/lib/auth";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

type AuthSessionResponse = AuthSessionState & {
	requestId: string;
};

type AccountControlsProps = {
	isLoading: boolean;
	session: AuthSessionState | null;
	onSessionChange: (session: AuthSessionState) => void;
};

const isAuthSessionResponse = (
	value: AuthSessionResponse | { error?: string } | null,
): value is AuthSessionResponse =>
	value !== null &&
	typeof value === "object" &&
	"threadOwnerKey" in value &&
	"isAuthenticated" in value;

const delay = (ms: number) =>
	new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const fetchAuthSession = async () => {
	try {
		const response = await fetch("/api/auth/session", {
			cache: "no-store",
			credentials: "same-origin",
		});
		const body = (await response.json().catch(() => null)) as
			| AuthSessionResponse
			| { error?: string }
			| null;

		return response.ok && isAuthSessionResponse(body) ? body : null;
	} catch {
		return null;
	}
};

const resolveCommittedSession = async ({
	expectedAuthenticated,
	expectedThreadOwnerKey,
	fallback,
}: {
	expectedAuthenticated: boolean;
	expectedThreadOwnerKey: string;
	fallback: AuthSessionResponse;
}) => {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const committedSession = await fetchAuthSession();

		if (
			committedSession &&
			committedSession.isAuthenticated === expectedAuthenticated &&
			committedSession.threadOwnerKey === expectedThreadOwnerKey
		) {
			return committedSession;
		}

		if (attempt < 4) {
			await delay(120 * (attempt + 1));
		}
	}

	return fallback;
};

const MODE_COPY: Record<
	AuthMode,
	{
		description: string;
		submitLabel: string;
		title: string;
	}
> = {
	login: {
		title: "Sign in",
		description: "Continue with your saved conversations and quotas.",
		submitLabel: "Sign in",
	},
	register: {
		title: "Create account",
		description:
			"Turn this browser session into an account you can use anywhere.",
		submitLabel: "Create account",
	},
};

export const AccountControls = ({
	isLoading,
	session,
	onSessionChange,
}: AccountControlsProps) => {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [mode, setMode] = useState<AuthMode>("login");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const authCopy = MODE_COPY[mode];
	const isAuthenticated = Boolean(session?.isAuthenticated && session.user);
	const statusLabel = isLoading
		? "Checking account..."
		: isAuthenticated
			? (session?.user?.name ?? "Signed in")
			: "Guest session";

	const resetTransientState = () => {
		setError(null);
		setName("");
		setPassword("");
	};

	const handleDialogOpenChange = (open: boolean) => {
		setDialogOpen(open);

		if (!open) {
			resetTransientState();
		}
	};

	const submitAuth = async () => {
		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch(`/api/auth/${mode}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "same-origin",
				body: JSON.stringify(
					mode === "register"
						? {
								email,
								name,
								password,
							}
						: {
								email,
								password,
							},
				),
			});
			const body = (await response.json().catch(() => null)) as
				| AuthSessionResponse
				| { error?: string }
				| null;

			if (!response.ok) {
				throw new Error(
					body && "error" in body && body.error
						? body.error
						: "Authentication failed.",
				);
			}
			if (!isAuthSessionResponse(body)) {
				throw new Error("Authentication response was invalid.");
			}

			const committedSession = await resolveCommittedSession({
				expectedAuthenticated: true,
				expectedThreadOwnerKey: body.threadOwnerKey,
				fallback: body,
			});

			startTransition(() => {
				onSessionChange({
					isAuthenticated: committedSession.isAuthenticated,
					threadOwnerKey: committedSession.threadOwnerKey,
					user: committedSession.user,
				});
			});
			setEmail("");
			handleDialogOpenChange(false);
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Authentication failed.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const signOut = async () => {
		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch("/api/auth/logout", {
				method: "POST",
				credentials: "same-origin",
			});
			const body = (await response.json().catch(() => null)) as
				| AuthSessionResponse
				| { error?: string }
				| null;

			if (!response.ok) {
				throw new Error(
					body && "error" in body && body.error
						? body.error
						: "Sign out failed.",
				);
			}
			if (!isAuthSessionResponse(body)) {
				throw new Error("Sign-out response was invalid.");
			}

			const committedSession = await resolveCommittedSession({
				expectedAuthenticated: false,
				expectedThreadOwnerKey: body.threadOwnerKey,
				fallback: body,
			});

			startTransition(() => {
				onSessionChange({
					isAuthenticated: committedSession.isAuthenticated,
					threadOwnerKey: committedSession.threadOwnerKey,
					user: committedSession.user,
				});
			});
		} catch (submitError) {
			setError(
				submitError instanceof Error ? submitError.message : "Sign out failed.",
			);
			setDialogOpen(true);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<div className="flex items-center gap-2">
				<div className="hidden rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-muted-foreground text-xs shadow-sm backdrop-blur sm:block">
					{statusLabel}
				</div>
				{isAuthenticated ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="rounded-full"
						disabled={isSubmitting}
						onClick={() => void signOut()}
					>
						Sign out
					</Button>
				) : (
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="rounded-full"
						disabled={isLoading}
						onClick={() => setDialogOpen(true)}
					>
						Sign in
					</Button>
				)}
			</div>

			<Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{authCopy.title}</DialogTitle>
						<DialogDescription>{authCopy.description}</DialogDescription>
					</DialogHeader>

					<form
						className="grid gap-3"
						onSubmit={(event) => {
							event.preventDefault();
							void submitAuth();
						}}
					>
						<div className="inline-flex rounded-full border bg-muted p-1">
							<button
								type="button"
								className={cn(
									"rounded-full px-3 py-1.5 font-medium text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5",
									mode === "login"
										? "bg-background text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_7px_0_-5px_rgba(96,165,250,0.48),0_14px_26px_-22px_rgba(17,82,153,0.58)]"
										: "text-muted-foreground hover:bg-background/60",
								)}
								onClick={() => {
									setError(null);
									setMode("login");
								}}
							>
								Sign in
							</button>
							<button
								type="button"
								className={cn(
									"rounded-full px-3 py-1.5 font-medium text-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0.5",
									mode === "register"
										? "bg-background text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_7px_0_-5px_rgba(96,165,250,0.48),0_14px_26px_-22px_rgba(17,82,153,0.58)]"
										: "text-muted-foreground hover:bg-background/60",
								)}
								onClick={() => {
									setError(null);
									setMode("register");
								}}
							>
								Create account
							</button>
						</div>

						{mode === "register" ? (
							<label className="grid gap-1.5" htmlFor="auth-name">
								<span className="font-medium text-sm">Name</span>
								<Input
									id="auth-name"
									autoComplete="name"
									disabled={isSubmitting}
									placeholder="Your name"
									type="text"
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</label>
						) : null}

						<label className="grid gap-1.5" htmlFor="auth-email">
							<span className="font-medium text-sm">Email</span>
							<Input
								id="auth-email"
								autoComplete="email"
								disabled={isSubmitting}
								inputMode="email"
								placeholder="you@example.com"
								type="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
							/>
						</label>

						<label className="grid gap-1.5" htmlFor="auth-password">
							<span className="font-medium text-sm">Password</span>
							<Input
								id="auth-password"
								autoComplete={
									mode === "login" ? "current-password" : "new-password"
								}
								disabled={isSubmitting}
								placeholder="At least 8 characters"
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						</label>

						{error ? (
							<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
								{error}
							</p>
						) : null}

						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								disabled={isSubmitting}
								onClick={() => handleDialogOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									isSubmitting ||
									(mode === "register" && name.trim().length < 2) ||
									email.trim().length === 0 ||
									password.length < 8
								}
							>
								{isSubmitting ? "Working..." : authCopy.submitLabel}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
};
