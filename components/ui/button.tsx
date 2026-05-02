import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"relative isolate inline-flex shrink-0 transform-gpu select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border border-transparent font-medium text-sm outline-none transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out before:pointer-events-none before:absolute before:inset-x-3 before:top-px before:h-px before:bg-white/70 before:content-[''] hover:-translate-y-px active:translate-y-0.5 active:scale-[0.99] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"border-orange-300/80 bg-amber-300 text-orange-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_4px_0_rgba(234,88,12,0.34),0_14px_24px_-18px_rgba(234,88,12,0.72)] hover:border-orange-200 hover:bg-amber-200 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.58),0_5px_0_rgba(234,88,12,0.28),0_18px_28px_-20px_rgba(234,88,12,0.68)] active:bg-orange-300 active:shadow-[inset_0_2px_7px_rgba(154,52,18,0.2),0_2px_0_rgba(234,88,12,0.3),0_10px_18px_-18px_rgba(234,88,12,0.58)]",
				destructive:
					"border-rose-300/70 bg-rose-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_4px_0_rgba(190,18,60,0.44),0_14px_24px_-18px_rgba(225,29,72,0.9)] hover:bg-rose-400 active:bg-rose-600 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
				outline:
					"border-white/85 bg-white/78 text-blue-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_4px_0_rgba(125,198,244,0.36),0_14px_24px_-20px_rgba(17,82,153,0.58)] backdrop-blur hover:border-sky-200 hover:bg-white/92 hover:text-blue-950 active:bg-sky-50/92 dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
				secondary:
					"border-amber-200/80 bg-amber-50/86 text-orange-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_4px_0_rgba(251,191,36,0.28),0_14px_24px_-20px_rgba(146,64,14,0.44)] hover:border-amber-200 hover:bg-amber-100/86 active:bg-amber-100",
				ghost:
					"border-transparent bg-transparent shadow-none before:bg-transparent hover:border-white/70 hover:bg-white/58 hover:text-blue-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_3px_0_rgba(125,198,244,0.24),0_12px_22px_-20px_rgba(17,82,153,0.52)] dark:hover:bg-accent/50",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
				xs: "h-7 gap-1 rounded-lg px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-9 gap-1.5 rounded-xl px-3.5 has-[>svg]:px-3",
				lg: "h-11 rounded-2xl px-6 has-[>svg]:px-4",
				icon: "size-10",
				"icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-9 rounded-xl",
				"icon-lg": "size-11 rounded-2xl",
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
