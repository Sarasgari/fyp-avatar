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
				["--thread-max-width" as string]: "80rem",
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
					"aui-thread-viewport relative flex flex-2 min-h-0 flex-col overflow-y-auto scroll-smooth px-2 pt-1 pb-2",
					compact && "px-1.5 pt-0.5 pb-1.5",
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
						"aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) shrink-0 flex-col gap-2 overflow-visible bg-[linear-gradient(180deg,rgba(3,5,16,0),rgba(3,5,16,0.92)_22%)] pt-4 pb-4",
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
				"mx-auto flex w-full max-w-(--thread-max-width) flex-col gap-3 px-2 pt-2 pb-2 sm:flex-row sm:items-start sm:justify-between",
				compact && "gap-2 pt-1.5 pb-1.5",
			)}
		>
			<div className="min-w-0">
				<div className="flex flex-wrap gap-2">
					<ThreadStatusChip
						icon={isThreadRunning ? LoaderCircleIcon : SparklesIcon}
						label="Assistant"
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
				<p className="mt-2 text-muted-foreground text-xs leading-5 sm:text-sm">
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
				size="sm"
				className="shrink-0"
				disabled={!canClearConversation}
				onClick={onClearConversation}
			>
				<Trash2Icon className="size-4" />
				Clear conversation
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
					? "border-emerald-300/35 bg-emerald-400/14 text-emerald-100 shadow-[0_0_20px_-12px_rgba(52,255,146,0.95)]"
					: "border-cyan-300/28 bg-slate-950/58 text-cyan-50 shadow-[0_0_20px_-13px_rgba(0,232,255,0.9)]",
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
				className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
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
		<div className="mx-auto w-full max-w-(--thread-max-width) px-2 pb-2">
			<div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/34 bg-fuchsia-400/12 px-3 py-1.5 text-fuchsia-50 text-xs shadow-[0_0_22px_-12px_rgba(255,0,171,0.9)]">
				<LoaderCircleIcon
					className={cn("size-3.5", !reducedMotion && "animate-spin")}
				/>
				<span className="font-medium">Generating a reply</span>
				<span className="text-fuchsia-100/78">
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
				"aui-thread-welcome-root mx-auto w-full max-w-(--thread-max-width) px-4 pt-3 pb-4",
				compact && "px-3 pt-2 pb-3",
			)}
		>
			<div
				className={cn(
					"aui-thread-welcome-message rounded-[28px] border border-fuchsia-300/26 bg-[linear-gradient(135deg,rgba(255,0,171,0.18),rgba(3,8,22,0.76)_42%,rgba(0,232,255,0.12))] px-5 py-5 shadow-[0_0_34px_-22px_rgba(255,0,171,0.85)]",
					compact && "rounded-[24px] px-4 py-4",
				)}
			>
				<h1
					className={cn(
						"font-semibold text-3xl tracking-tight",
						compact && "text-2xl",
					)}
				>
					Hi there
				</h1>
				<p className="mt-2 max-w-2xl text-muted-foreground text-base leading-7 sm:text-lg">
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
				"aui-thread-welcome-suggestions grid w-full gap-2 pb-4 @md:grid-cols-2",
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
						"aui-thread-welcome-suggestion h-auto w-full flex-wrap items-start justify-start gap-1 rounded-2xl border border-cyan-300/24 bg-slate-950/54 px-4 py-3 text-left text-sm text-cyan-50 transition-colors hover:bg-cyan-300/12 @md:flex-col",
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
					"aui-composer-attachment-dropzone flex w-full flex-col rounded-2xl border border-cyan-300/32 bg-slate-950/76 px-1 pt-2 shadow-[0_0_36px_-22px_rgba(0,232,255,0.9)] outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/25 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/20",
					compact && "rounded-[20px] pt-1.5",
				)}
			>
				<ComposerAttachments />
				<ComposerPrimitive.Input
					placeholder="Send a message..."
					className={cn(
						"aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0",
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
						className="aui-composer-send size-8 rounded-full"
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
						className="aui-composer-cancel size-8 rounded-full"
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
			<span>Press Enter to send. Shift + Enter for a new line.</span>
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
				"aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-3 duration-150",
				compact && "py-2",
			)}
			data-role="assistant"
		>
			<div className="aui-assistant-message-content wrap-break-word rounded-[24px] border border-cyan-300/22 bg-cyan-300/8 px-4 py-3 text-cyan-50 leading-relaxed shadow-[0_0_30px_-22px_rgba(0,232,255,0.85)]">
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
				"aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150 [&:where(>*)]:col-start-2",
				compact && "gap-y-1.5 py-2.5",
			)}
			data-role="user"
		>
			<UserMessageAttachments />

			<div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
				<div className="aui-user-message-content wrap-break-word rounded-2xl bg-[linear-gradient(135deg,#ff007a,#7a2cff)] px-4 py-2.5 text-white shadow-[0_0_30px_-14px_rgba(255,0,171,0.88)]">
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
					"aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl border border-fuchsia-300/24 bg-slate-950/76",
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
