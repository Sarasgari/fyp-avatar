import {
	ActionBarMorePrimitive,
	ActionBarPrimitive,
	AuiIf,
	BranchPickerPrimitive,
	ComposerPrimitive,
	ErrorPrimitive,
	MessagePrimitive,
	SuggestionPrimitive,
	ThreadPrimitive,
	useThread,
} from "@assistant-ui/react";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CopyIcon,
	DownloadIcon,
	LoaderCircleIcon,
	MoreHorizontalIcon,
	PencilIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
	SparklesIcon,
	SquareIcon,
	Trash2Icon,
} from "lucide-react";
import type { FC } from "react";
import {
	ComposerAddAttachment,
	ComposerAttachments,
	UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { SpeechSyncedMarkdownText } from "@/components/assistant-ui/speech-synced-markdown-text";
import { ThreadVoiceController } from "@/components/assistant-ui/thread-voice-controller";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import type { BodyState, EmotionState, SpeechState } from "@/lib/avatar-state";
import { cn } from "@/lib/utils";

export type ThreadProps = {
	onUserSend?: () => void;
	onEmotionStateChange?: (emotion: EmotionState) => void;
	onBodyStateChange?: (state: BodyState) => void;
	onSpeechStateChange?: (state: SpeechState) => void;
	stopSpeechRequest?: number;
	voiceEnabled?: boolean;
	reducedMotion?: boolean;
	compact?: boolean;
	isPersistenceReady?: boolean;
	hasSavedConversation?: boolean;
	persistenceScope?: "guest" | "user";
	canClearConversation?: boolean;
	onClearConversation?: () => void;
};

export const Thread: FC<ThreadProps> = ({
	onUserSend,
	onEmotionStateChange,
	onBodyStateChange,
	onSpeechStateChange,
	stopSpeechRequest,
	voiceEnabled = true,
	reducedMotion = false,
	compact = false,
	isPersistenceReady = true,
	hasSavedConversation = false,
	persistenceScope = "guest",
	canClearConversation = false,
	onClearConversation,
}) => {
	const isThreadRunning = useThread((thread) => thread.isRunning);
	const hasAnyMessages = useThread((thread) => thread.messages.length > 0);
	const assistantMessage = () => <AssistantMessage compact={compact} />;
	const editComposer = () => <EditComposer compact={compact} />;
	const userMessage = () => <UserMessage compact={compact} />;

	return (
		<ThreadPrimitive.Root
			className={cn(
				"aui-root aui-thread-root @container flex h-full min-h-1 flex-col bg-transparent",
				compact && "text-[0.95rem]",
			)}
			style={{
				["--thread-max-width" as string]: "100%",
			}}
		>
			<ThreadVoiceController
				onEmotionStateChange={onEmotionStateChange}
				onBodyStateChange={onBodyStateChange}
				onSpeechStateChange={onSpeechStateChange}
				stopSpeechRequest={stopSpeechRequest}
				voiceEnabled={voiceEnabled}
			/>
			<ThreadToolbar
				isPersistenceReady={isPersistenceReady}
				hasSavedConversation={hasSavedConversation}
				persistenceScope={persistenceScope}
				canClearConversation={canClearConversation}
				hasAnyMessages={hasAnyMessages}
				isThreadRunning={isThreadRunning}
				onClearConversation={onClearConversation}
				compact={compact}
			/>
			<ThreadPrimitive.Viewport
				turnAnchor="top"
				className={cn(
					"aui-thread-viewport relative flex flex-2 min-h-0 flex-col overflow-y-auto scroll-smooth px-3 pt-1 pb-2",
					compact && "px-2.5 pt-0.5 pb-1.5",
				)}
			>
				<AuiIf
					condition={(s) =>
						isPersistenceReady && !s.thread.isEmpty && s.thread.isRunning
					}
				>
					<ThreadRunNotice
						reducedMotion={reducedMotion}
						voiceEnabled={voiceEnabled}
					/>
				</AuiIf>
				<AuiIf condition={(s) => isPersistenceReady && s.thread.isEmpty}>
					<ThreadWelcome compact={compact} reducedMotion={reducedMotion} />
				</AuiIf>
				<ThreadPrimitive.Messages
					components={{
						UserMessage: userMessage,
						EditComposer: editComposer,
						AssistantMessage: assistantMessage,
					}}
				/>

				<ThreadPrimitive.ViewportFooter
					className={cn(
						"aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) shrink-0 flex-col gap-2 overflow-visible bg-[linear-gradient(180deg,rgba(239,248,255,0),rgba(239,248,255,0.92)_24%)] pt-4 pb-3",
						compact && "gap-1.5 pt-3 pb-3",
					)}
				>
					<ThreadScrollToBottom />
					<Composer
						compact={compact}
						onUserSend={onUserSend}
						reducedMotion={reducedMotion}
					/>
				</ThreadPrimitive.ViewportFooter>
			</ThreadPrimitive.Viewport>
		</ThreadPrimitive.Root>
	);
};

type ThreadToolbarProps = {
	isPersistenceReady: boolean;
	hasSavedConversation: boolean;
	persistenceScope: "guest" | "user";
	canClearConversation: boolean;
	hasAnyMessages: boolean;
	isThreadRunning: boolean;
	onClearConversation?: () => void;
	compact?: boolean;
};

const ThreadToolbar: FC<ThreadToolbarProps> = ({
	isPersistenceReady,
	hasSavedConversation,
	persistenceScope,
	canClearConversation,
	hasAnyMessages,
	isThreadRunning,
	onClearConversation,
	compact = false,
}) => {
	const savedCopy =
		persistenceScope === "user"
			? "Conversation is saved to your account."
			: "Conversation is saved for this session.";
	const unsavedCopy =
		persistenceScope === "user"
			? "New conversations are saved to your account until you clear them."
			: "New conversations are saved for this session until you clear them.";
	const runCopy = isThreadRunning
		? "Working on a reply now."
		: hasAnyMessages
			? "Ready for the next turn."
			: "Ready when you are.";

	return (
		<div
			className={cn(
				"mx-auto flex w-full max-w-(--thread-max-width) items-start justify-between gap-3 px-4 pt-4 pb-2",
				compact && "gap-2 pt-1.5 pb-1.5",
			)}
		>
			<div className="min-w-0">
				<div className="flex min-w-0 flex-wrap gap-2">
					<ThreadStatusChip
						icon={isThreadRunning ? LoaderCircleIcon : SparklesIcon}
						label="Chat"
						value={runCopy}
						animate={isThreadRunning}
					/>
					<ThreadStatusChip
						icon={ShieldCheckIcon}
						label="History"
						value={
							isPersistenceReady
								? hasSavedConversation
									? "Saved"
									: "Ready to save"
								: "Restoring"
						}
						tone={hasSavedConversation ? "success" : "default"}
					/>
				</div>
				<p className="mt-2 line-clamp-2 text-muted-foreground text-xs leading-5">
					{isPersistenceReady
						? hasSavedConversation
							? savedCopy
							: unsavedCopy
						: "Restoring your saved conversation..."}
				</p>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-9 shrink-0 rounded-full border-white/70 bg-white/54 text-blue-800/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_8px_0_-5px_rgba(125,198,244,0.48),0_16px_28px_-24px_rgba(17,82,153,0.58)] hover:bg-white/84 hover:text-blue-950"
				disabled={!canClearConversation}
				onClick={onClearConversation}
				aria-label="Clear conversation"
			>
				<Trash2Icon className="size-4" />
			</Button>
		</div>
	);
};

type ThreadStatusChipProps = {
	icon: typeof SparklesIcon;
	label: string;
	value: string;
	tone?: "default" | "success";
	animate?: boolean;
};

const ThreadStatusChip: FC<ThreadStatusChipProps> = ({
	icon: Icon,
	label,
	value,
	tone = "default",
	animate = false,
}) => {
	return (
		<div
			className={cn(
				"inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm",
				tone === "success"
					? "border-blue-200/85 bg-blue-50/88 text-blue-950"
					: "border-white/70 bg-white/62 text-blue-950 backdrop-blur-xl",
			)}
		>
			<Icon className={cn("size-3.5 shrink-0", animate && "animate-spin")} />
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value}</span>
		</div>
	);
};

const ThreadScrollToBottom: FC = () => {
	return (
		<ThreadPrimitive.ScrollToBottom asChild>
			<TooltipIconButton
				tooltip="Scroll to bottom"
				variant="outline"
				className="aui-thread-scroll-to-bottom absolute -top-11 z-10 size-9 self-center rounded-full bg-white/84 p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_0_-5px_rgba(96,165,250,0.55),0_18px_30px_-22px_rgba(17,82,153,0.62)] disabled:invisible dark:bg-background dark:hover:bg-accent"
			>
				<ArrowDownIcon />
			</TooltipIconButton>
		</ThreadPrimitive.ScrollToBottom>
	);
};

type ThreadRunNoticeProps = {
	reducedMotion?: boolean;
	voiceEnabled: boolean;
};

const ThreadRunNotice: FC<ThreadRunNoticeProps> = ({
	reducedMotion = false,
	voiceEnabled,
}) => {
	return (
		<div className="mx-auto w-full max-w-(--thread-max-width) px-1 pb-2">
			<div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/90 px-3 py-1.5 text-blue-950 text-xs shadow-sm">
				<LoaderCircleIcon
					className={cn("size-3.5", !reducedMotion && "animate-spin")}
				/>
				<span className="font-medium">Generating a reply</span>
				<span className="truncate text-blue-900/80">
					{voiceEnabled
						? "Voice playback will start automatically when the response is ready."
						: "Voice is muted, so the response will stay text-first."}
				</span>
			</div>
		</div>
	);
};

type ThreadWelcomeProps = {
	compact?: boolean;
	reducedMotion?: boolean;
};

const ThreadWelcome: FC<ThreadWelcomeProps> = ({
	compact = false,
	reducedMotion = false,
}) => {
	return (
		<div
			className={cn(
				"aui-thread-welcome-root mx-auto w-full max-w-(--thread-max-width) px-1 pt-2 pb-4",
				compact && "px-3 pt-2 pb-3",
			)}
		>
			<div
				className={cn(
					"aui-thread-welcome-message rounded-[24px] border border-white/70 bg-white/62 px-4 py-4 shadow-sm backdrop-blur-xl",
					compact && "rounded-[20px] px-4 py-4",
				)}
			>
				<h1
					className={cn(
						"font-semibold text-2xl tracking-tight",
						compact && "text-xl",
					)}
				>
					Hi there
				</h1>
				<p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
					Ask me anything, talk through a problem, or rehearse your next idea
					out loud. The avatar and voice will follow the tone of the reply.
				</p>
			</div>

			<div className="mt-4">
				<ThreadSuggestions compact={compact} reducedMotion={reducedMotion} />
			</div>
		</div>
	);
};

type ThreadSuggestionsProps = {
	compact?: boolean;
	reducedMotion?: boolean;
};

const ThreadSuggestions: FC<ThreadSuggestionsProps> = ({
	compact = false,
	reducedMotion = false,
}) => {
	return (
		<div
			className={cn(
				"aui-thread-welcome-suggestions grid w-full gap-2 pb-4",
				compact && "gap-1.5 pb-2",
			)}
		>
			<ThreadPrimitive.Suggestions
				components={{
					Suggestion: () => (
						<ThreadSuggestionItem
							compact={compact}
							reducedMotion={reducedMotion}
						/>
					),
				}}
			/>
		</div>
	);
};

type ThreadSuggestionItemProps = {
	compact?: boolean;
	reducedMotion?: boolean;
};

const ThreadSuggestionItem: FC<ThreadSuggestionItemProps> = ({
	compact = false,
	reducedMotion = false,
}) => {
	return (
		<div
			className={cn(
				"aui-thread-welcome-suggestion-display @md:nth-[n+3]:block nth-[n+3]:hidden",
				!reducedMotion &&
					"fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200",
			)}
		>
			<SuggestionPrimitive.Trigger send asChild>
				<Button
					variant="ghost"
					className={cn(
						"aui-thread-welcome-suggestion h-auto w-full flex-wrap items-start justify-start gap-1 rounded-2xl border-white/78 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(219,234,254,0.66))] px-4 py-3 text-left text-blue-950 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_9px_0_-5px_rgba(96,165,250,0.45),0_18px_34px_-26px_rgba(17,82,153,0.64)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(191,219,254,0.76))] @md:flex-col",
						compact && "px-3 py-2.5 text-[13px]",
					)}
				>
					<span className="aui-thread-welcome-suggestion-text-1 font-medium">
						<SuggestionPrimitive.Title />
					</span>
					<span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
						<SuggestionPrimitive.Description />
					</span>
				</Button>
			</SuggestionPrimitive.Trigger>
		</div>
	);
};

type ComposerProps = {
	onUserSend?: () => void;
	reducedMotion?: boolean;
	compact?: boolean;
};

const Composer: FC<ComposerProps> = ({
	onUserSend,
	reducedMotion = false,
	compact = false,
}) => {
	return (
		<ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
			<ComposerPrimitive.AttachmentDropzone
				className={cn(
					"aui-composer-attachment-dropzone flex w-full flex-col rounded-[24px] border border-white/80 bg-white/88 px-1 pt-2 shadow-[0_14px_42px_-28px_rgba(17,82,153,0.42)] outline-none backdrop-blur-xl transition-shadow has-[textarea:focus-visible]:border-blue-400 has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-blue-400/25 data-[dragging=true]:border-blue-400 data-[dragging=true]:border-dashed data-[dragging=true]:bg-blue-50/70",
					compact && "rounded-[20px] pt-1.5",
				)}
			>
				<ComposerAttachments />
				<ComposerPrimitive.Input
					placeholder="Send a message..."
					className={cn(
						"aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0",
						compact && "min-h-12 px-3.5 pt-1.5 pb-2.5 text-[13px]",
					)}
					rows={1}
					autoFocus
					aria-label="Message input"
				/>
				<ComposerAction onUserSend={onUserSend} />
				<ComposerHint compact={compact} reducedMotion={reducedMotion} />
			</ComposerPrimitive.AttachmentDropzone>
		</ComposerPrimitive.Root>
	);
};

type ComposerActionProps = {
	onUserSend?: () => void;
};

const ComposerAction: FC<ComposerActionProps> = ({ onUserSend }) => {
	return (
		<div className="aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-between">
			<ComposerAddAttachment />
			<AuiIf condition={(s) => !s.thread.isRunning}>
				<ComposerPrimitive.Send asChild>
					<TooltipIconButton
						tooltip="Send message"
						side="bottom"
						type="submit"
						variant="default"
						size="icon"
						className="aui-composer-send size-9 rounded-full bg-[linear-gradient(180deg,#93c5fd_0%,#3b82f6_52%,#2563eb_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_9px_0_-5px_rgba(29,78,216,0.72),0_20px_36px_-20px_rgba(37,99,235,0.92)] hover:bg-[linear-gradient(180deg,#bfdbfe_0%,#60a5fa_48%,#2563eb_100%)]"
						aria-label="Send message"
						onClick={() => onUserSend?.()}
					>
						<ArrowUpIcon className="aui-composer-send-icon size-4" />
					</TooltipIconButton>
				</ComposerPrimitive.Send>
			</AuiIf>
			<AuiIf condition={(s) => s.thread.isRunning}>
				<ComposerPrimitive.Cancel asChild>
					<Button
						type="button"
						variant="default"
						size="icon"
						className="aui-composer-cancel size-9 rounded-full bg-[linear-gradient(180deg,#1e3a8a_0%,#172554_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_9px_0_-5px_rgba(15,23,42,0.78),0_18px_34px_-20px_rgba(15,23,42,0.72)]"
						aria-label="Stop generating"
					>
						<SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
					</Button>
				</ComposerPrimitive.Cancel>
			</AuiIf>
		</div>
	);
};

type ComposerHintProps = {
	reducedMotion?: boolean;
	compact?: boolean;
};

const ComposerHint: FC<ComposerHintProps> = ({
	reducedMotion = false,
	compact = false,
}) => {
	return (
		<div
			className={cn(
				"mx-3 mt-0 mb-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground",
				compact && "mx-2.5 mb-1.5 gap-2 text-[10px]",
			)}
		>
			<span>Enter to send. Shift + Enter for a new line.</span>
			<AuiIf condition={(s) => s.thread.isRunning}>
				<span className="inline-flex items-center gap-1 font-medium text-foreground/80">
					<LoaderCircleIcon
						className={cn("size-3", !reducedMotion && "animate-spin")}
					/>
					Replying...
				</span>
			</AuiIf>
		</div>
	);
};

const MessageError: FC = () => {
	return (
		<MessagePrimitive.Error>
			<ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
				<ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
			</ErrorPrimitive.Root>
		</MessagePrimitive.Error>
	);
};

type AssistantMessageProps = {
	compact?: boolean;
};

const AssistantMessage: FC<AssistantMessageProps> = ({ compact = false }) => {
	return (
		<MessagePrimitive.Root
			className={cn(
				"aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-2.5 duration-150",
				compact && "py-2",
			)}
			data-role="assistant"
		>
			<div className="aui-assistant-message-content wrap-break-word rounded-[22px] border border-white/70 bg-white/64 px-4 py-3 text-blue-950 leading-relaxed shadow-sm backdrop-blur-xl">
				<MessagePrimitive.Parts
					components={{
						Text: SpeechSyncedMarkdownText,
						tools: { Fallback: ToolFallback },
					}}
				/>
				<MessageError />
			</div>

			<div className="aui-assistant-message-footer mt-1 ml-2 flex">
				<BranchPicker />
				<AssistantActionBar />
			</div>
		</MessagePrimitive.Root>
	);
};

const AssistantActionBar: FC = () => {
	return (
		<ActionBarPrimitive.Root
			hideWhenRunning
			autohide="not-last"
			autohideFloat="single-branch"
			className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
		>
			<ActionBarPrimitive.Copy asChild>
				<TooltipIconButton tooltip="Copy">
					<AuiIf condition={(s) => s.message.isCopied}>
						<CheckIcon />
					</AuiIf>
					<AuiIf condition={(s) => !s.message.isCopied}>
						<CopyIcon />
					</AuiIf>
				</TooltipIconButton>
			</ActionBarPrimitive.Copy>
			<ActionBarPrimitive.Reload asChild>
				<TooltipIconButton tooltip="Refresh">
					<RefreshCwIcon />
				</TooltipIconButton>
			</ActionBarPrimitive.Reload>
			<ActionBarMorePrimitive.Root>
				<ActionBarMorePrimitive.Trigger asChild>
					<TooltipIconButton
						tooltip="More"
						className="data-[state=open]:bg-accent"
					>
						<MoreHorizontalIcon />
					</TooltipIconButton>
				</ActionBarMorePrimitive.Trigger>
				<ActionBarMorePrimitive.Content
					side="bottom"
					align="start"
					className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
				>
					<ActionBarPrimitive.ExportMarkdown asChild>
						<ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
							<DownloadIcon className="size-4" />
							Export as Markdown
						</ActionBarMorePrimitive.Item>
					</ActionBarPrimitive.ExportMarkdown>
				</ActionBarMorePrimitive.Content>
			</ActionBarMorePrimitive.Root>
		</ActionBarPrimitive.Root>
	);
};

type UserMessageProps = {
	compact?: boolean;
};

const UserMessage: FC<UserMessageProps> = ({ compact = false }) => {
	return (
		<MessagePrimitive.Root
			className={cn(
				"aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(42px,1fr)_auto] content-start gap-y-2 px-1 py-2.5 duration-150 [&:where(>*)]:col-start-2",
				compact && "gap-y-1.5 py-2.5",
			)}
			data-role="user"
		>
			<UserMessageAttachments />

			<div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
				<div className="aui-user-message-content wrap-break-word rounded-[20px] bg-blue-600 px-4 py-2.5 text-white shadow-sm">
					<MessagePrimitive.Parts />
				</div>
				<div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
					<UserActionBar />
				</div>
			</div>

			<BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
		</MessagePrimitive.Root>
	);
};

const UserActionBar: FC = () => {
	return (
		<ActionBarPrimitive.Root
			hideWhenRunning
			autohide="not-last"
			className="aui-user-action-bar-root flex flex-col items-end"
		>
			<ActionBarPrimitive.Edit asChild>
				<TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
					<PencilIcon />
				</TooltipIconButton>
			</ActionBarPrimitive.Edit>
		</ActionBarPrimitive.Root>
	);
};

type EditComposerProps = {
	compact?: boolean;
};

const EditComposer: FC<EditComposerProps> = ({ compact = false }) => {
	return (
		<MessagePrimitive.Root
			className={cn(
				"aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3",
				compact && "py-2",
			)}
		>
			<ComposerPrimitive.Root
				className={cn(
					"aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-white/88",
					compact && "rounded-[20px]",
				)}
			>
				<ComposerPrimitive.Input
					className={cn(
						"aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none",
						compact && "min-h-12 p-3.5 text-[13px]",
					)}
					autoFocus
				/>
				<div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
					<ComposerPrimitive.Cancel asChild>
						<Button variant="ghost" size="sm">
							Cancel
						</Button>
					</ComposerPrimitive.Cancel>
					<ComposerPrimitive.Send asChild>
						<Button size="sm">Update</Button>
					</ComposerPrimitive.Send>
				</div>
			</ComposerPrimitive.Root>
		</MessagePrimitive.Root>
	);
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
	className,
	...rest
}) => {
	return (
		<BranchPickerPrimitive.Root
			hideWhenSingleBranch
			className={cn(
				"aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs",
				className,
			)}
			{...rest}
		>
			<BranchPickerPrimitive.Previous asChild>
				<TooltipIconButton tooltip="Previous">
					<ChevronLeftIcon />
				</TooltipIconButton>
			</BranchPickerPrimitive.Previous>
			<span className="aui-branch-picker-state font-medium">
				<BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
			</span>
			<BranchPickerPrimitive.Next asChild>
				<TooltipIconButton tooltip="Next">
					<ChevronRightIcon />
				</TooltipIconButton>
			</BranchPickerPrimitive.Next>
		</BranchPickerPrimitive.Root>
	);
};
