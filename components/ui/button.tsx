import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"relative isolate inline-flex shrink-0 transform-gpu select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md border border-transparent font-medium text-sm outline-none transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out before:pointer-events-none before:absolute before:inset-x-2 before:top-px before:h-px before:bg-white/70 before:content-[''] hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"border-blue-300/60 bg-[linear-gradient(180deg,#60a5fa_0%,#2563eb_56%,#1d4ed8_100%)] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_9px_0_-5px_rgba(29,78,216,0.72),0_18px_34px_-20px_rgba(37,99,235,0.92)] hover:border-blue-200/80 hover:bg-[linear-gradient(180deg,#7dd3fc_0%,#3b82f6_52%,#2563eb_100%)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_11px_0_-5px_rgba(29,78,216,0.72),0_24px_42px_-20px_rgba(37,99,235,0.96)] active:shadow-[inset_0_2px_8px_rgba(30,64,175,0.35),0_5px_0_-5px_rgba(29,78,216,0.72),0_12px_24px_-20px_rgba(37,99,235,0.8)]",
				destructive:
					"border-red-300/70 bg-[linear-gradient(180deg,#fb7185_0%,#dc2626_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_9px_0_-5px_rgba(153,27,27,0.72),0_18px_34px_-20px_rgba(220,38,38,0.9)] hover:bg-[linear-gradient(180deg,#fda4af_0%,#ef4444_100%)] focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
				outline:
					"border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(219,234,254,0.86)_100%)] text-blue-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_0_-5px_rgba(125,198,244,0.7),0_18px_32px_-22px_rgba(17,82,153,0.62)] hover:border-blue-200/90 hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(191,219,254,0.9)_100%)] hover:text-blue-950 dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
				secondary:
					"border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(191,219,254,0.84)_100%)] text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_0_-5px_rgba(96,165,250,0.58),0_16px_30px_-22px_rgba(17,82,153,0.62)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(147,197,253,0.82)_100%)]",
				ghost:
					"shadow-none before:bg-white/45 hover:border-white/70 hover:bg-white/62 hover:text-blue-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_8px_0_-5px_rgba(125,198,244,0.52),0_16px_30px_-24px_rgba(17,82,153,0.58)] dark:hover:bg-accent/50",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
