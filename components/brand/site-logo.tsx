import { LeafIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
	className?: string;
};

export const SiteLogoMark = ({ className }: SiteLogoMarkProps) => {
	return (
		<div
			aria-label="Mango"
			role="img"
			className={cn(
				"relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-amber-300 text-orange-950 shadow-sm",
				className,
			)}
		>
			<div className="absolute -left-3 -top-4 size-9 rounded-full bg-orange-400/70" />
			<div className="absolute right-1 bottom-1 size-4 rounded-full bg-white/24" />
			<span className="relative font-black text-base tracking-normal">M</span>
			<LeafIcon className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-white/95 p-0.5 text-emerald-700" />
		</div>
	);
};
