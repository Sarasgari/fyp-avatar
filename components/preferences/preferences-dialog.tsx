"use client";

import {
	EyeIcon,
	LayoutPanelTopIcon,
	Settings2Icon,
	SparklesIcon,
	Volume2Icon,
} from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { UserPreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

type PreferencesDialogProps = {
	onChange: (preferences: UserPreferences) => void;
	onReset: () => void;
	preferences: UserPreferences;
};

type PreferenceToggleProps = {
	checked: boolean;
	description: string;
	icon: typeof Settings2Icon;
	label: string;
	onCheckedChange: (checked: boolean) => void;
};

const PreferenceToggle = ({
	checked,
	description,
	icon: Icon,
	label,
	onCheckedChange,
}: PreferenceToggleProps) => {
	const inputId = useId();

	return (
		<label
			htmlFor={inputId}
			className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 transition-colors hover:bg-accent/30"
		>
			<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-foreground shadow-sm">
				<Icon className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="font-medium text-sm">{label}</div>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					{description}
				</p>
			</div>
			<div className="pt-1">
				<input
					id={inputId}
					checked={checked}
					className={cn(
						"mt-1 size-4 rounded border-border bg-background accent-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
					)}
					type="checkbox"
					onChange={(event) => onCheckedChange(event.target.checked)}
				/>
			</div>
		</label>
	);
};

export const PreferencesDialog = ({
	onChange,
	onReset,
	preferences,
}: PreferencesDialogProps) => {
	const [open, setOpen] = useState(false);

	const updatePreference = <K extends keyof UserPreferences>(
		key: K,
		value: UserPreferences[K],
	) => {
		onChange({
			...preferences,
			[key]: value,
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full"
				>
					<Settings2Icon className="size-4" />
					Settings
				</Button>
			</DialogTrigger>
			<DialogContent className="overflow-hidden rounded-[28px] border-border/70 bg-background/95 p-0 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.55)] backdrop-blur sm:max-w-xl">
				<div className="border-border/70 border-b px-6 py-5">
					<DialogHeader className="text-left">
						<DialogTitle>Preferences</DialogTitle>
						<DialogDescription>
							Tune how this assistant feels on this device without changing your
							backend setup.
						</DialogDescription>
					</DialogHeader>
				</div>

				<div className="grid gap-3 px-6 py-5">
					<PreferenceToggle
						checked={preferences.voiceEnabled}
						description="Play voice responses automatically when an answer finishes."
						icon={Volume2Icon}
						label="Voice playback"
						onCheckedChange={(checked) =>
							updatePreference("voiceEnabled", checked)
						}
					/>
					<PreferenceToggle
						checked={preferences.avatarVisible}
						description="Show or hide the live avatar stage while keeping the rest of the assistant available."
						icon={EyeIcon}
						label="Avatar visibility"
						onCheckedChange={(checked) =>
							updatePreference("avatarVisible", checked)
						}
					/>
					<PreferenceToggle
						checked={preferences.reducedMotion}
						description="Tone down motion-heavy avatar and interface effects for a calmer experience."
						icon={SparklesIcon}
						label="Reduced motion"
						onCheckedChange={(checked) =>
							updatePreference("reducedMotion", checked)
						}
					/>
					<PreferenceToggle
						checked={preferences.compactChat}
						description="Tighten spacing in the shell and chat surface so more conversation fits onscreen."
						icon={LayoutPanelTopIcon}
						label="Compact chat"
						onCheckedChange={(checked) =>
							updatePreference("compactChat", checked)
						}
					/>
				</div>

				<DialogFooter className="border-border/70 border-t px-6 py-4">
					<Button type="button" variant="ghost" onClick={onReset}>
						Reset defaults
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => setOpen(false)}
					>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
