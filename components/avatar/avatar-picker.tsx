"use client";

import { CheckIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import AvatarCanvas from "@/components/ui/avatar-canvas";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	AVATAR_OPTIONS,
	type AvatarId,
	type AvatarOption,
	getAvatarOption,
} from "@/lib/avatar-catalog";
import { cn } from "@/lib/utils";

type AvatarPickerGridProps = {
	selectedAvatarId: AvatarId;
	onSelect: (avatarId: AvatarId) => void;
};

type AvatarPickerDialogProps = AvatarPickerGridProps & {
	open: boolean;
	onOpenChange?: (open: boolean) => void;
	required?: boolean;
};

const AvatarCard = ({
	avatar,
	isPreviewed,
	isSelected,
	onSelect,
	onPreview,
}: {
	avatar: AvatarOption;
	isPreviewed: boolean;
	isSelected: boolean;
	onSelect: () => void;
	onPreview: () => void;
}) => (
	<button
		type="button"
		className={cn(
			"group grid min-h-32 text-left transition-all duration-200 hover:-translate-y-px active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
			"rounded-2xl border bg-white/76 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_3px_0_rgba(125,198,244,0.24),0_12px_22px_-18px_rgba(17,82,153,0.48)] backdrop-blur",
			isSelected
				? "border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_4px_0_rgba(37,99,235,0.34),0_14px_24px_-18px_rgba(37,99,235,0.74)]"
				: isPreviewed
					? "border-sky-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_4px_0_rgba(14,165,233,0.24),0_14px_24px_-20px_rgba(14,165,233,0.62)]"
					: "border-white/70 hover:border-blue-200",
		)}
		onFocus={onPreview}
		onPointerEnter={onPreview}
		onClick={onSelect}
	>
		<div className="flex items-start justify-between gap-3">
			<div
				className={cn(
					"flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-blue-950 shadow-sm",
					avatar.accentClass,
				)}
			>
				<SparklesIcon className="size-5" />
			</div>
			<div
				className={cn(
					"flex size-6 items-center justify-center rounded-full border",
					isSelected
						? "border-blue-300 bg-blue-600 text-white"
						: "border-blue-100 bg-white/70 text-transparent",
				)}
			>
				<CheckIcon className="size-3.5" />
			</div>
		</div>
		<div className="mt-3">
			<div className="font-semibold text-blue-950 text-sm">{avatar.name}</div>
			<p className="mt-1 text-blue-900/70 text-xs leading-5">
				{avatar.description}
			</p>
		</div>
	</button>
);

const AvatarPreviewPanel = ({
	avatar,
	isSelected,
	onSelect,
}: {
	avatar: AvatarOption;
	isSelected: boolean;
	onSelect: () => void;
}) => (
	<div className="min-w-0 rounded-[26px] border border-white/75 bg-white/72 p-3 shadow-sm backdrop-blur">
		<div className="h-[18rem] overflow-hidden rounded-[22px] sm:h-[21rem]">
			<AvatarCanvas
				key={avatar.id}
				bodyState="idleDance"
				emotionState="happy"
				modelPath={avatar.modelPath}
				reducedMotion={false}
				speechState="silent"
			/>
		</div>
		<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<div className="text-blue-900/65 text-xs">Character preview</div>
				<h3 className="truncate font-semibold text-blue-950 text-lg">
					{avatar.name}
				</h3>
				<p className="mt-1 text-blue-900/70 text-sm leading-6">
					{avatar.description}
				</p>
			</div>
			{isSelected ? (
				<div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/86 px-3 py-2 font-medium text-emerald-950 text-sm shadow-sm">
					<CheckIcon className="size-4" />
					Selected
				</div>
			) : (
				<Button
					type="button"
					className="shrink-0 rounded-full"
					onClick={onSelect}
				>
					<SparklesIcon className="size-4" />
					Use character
				</Button>
			)}
		</div>
	</div>
);

export const AvatarPickerGrid = ({
	selectedAvatarId,
	onSelect,
}: AvatarPickerGridProps) => {
	const [previewAvatarId, setPreviewAvatarId] =
		useState<AvatarId>(selectedAvatarId);
	const previewAvatar = getAvatarOption(previewAvatarId);

	useEffect(() => {
		setPreviewAvatarId(selectedAvatarId);
	}, [selectedAvatarId]);

	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
			<AvatarPreviewPanel
				avatar={previewAvatar}
				isSelected={previewAvatar.id === selectedAvatarId}
				onSelect={() => onSelect(previewAvatar.id)}
			/>
			<div className="grid max-h-[58vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
				{AVATAR_OPTIONS.map((avatar) => (
					<AvatarCard
						key={avatar.id}
						avatar={avatar}
						isPreviewed={avatar.id === previewAvatar.id}
						isSelected={avatar.id === selectedAvatarId}
						onPreview={() => setPreviewAvatarId(avatar.id)}
						onSelect={() => onSelect(avatar.id)}
					/>
				))}
			</div>
		</div>
	);
};

export const AvatarPickerDialog = ({
	open,
	onOpenChange,
	required = false,
	selectedAvatarId,
	onSelect,
}: AvatarPickerDialogProps) => (
	<Dialog
		open={open}
		onOpenChange={(nextOpen) => {
			if (required && !nextOpen) {
				return;
			}
			onOpenChange?.(nextOpen);
		}}
	>
		<DialogContent
			className="overflow-hidden rounded-[28px] border-white/70 bg-sky-50/95 p-0 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.55)] backdrop-blur sm:max-w-6xl"
			showCloseButton={!required}
		>
			<div className="border-white/70 border-b px-6 py-5">
				<DialogHeader className="text-left">
					<DialogTitle>Choose your avatar</DialogTitle>
					<DialogDescription>
						This is the character that will appear on your live stage after
						signing in.
					</DialogDescription>
				</DialogHeader>
			</div>
			<div className="px-6 py-5">
				<AvatarPickerGrid
					selectedAvatarId={selectedAvatarId}
					onSelect={onSelect}
				/>
				{required ? (
					<div className="mt-4 flex justify-end">
						<Button type="button" onClick={() => onOpenChange?.(false)}>
							Continue
						</Button>
					</div>
				) : null}
			</div>
		</DialogContent>
	</Dialog>
);
