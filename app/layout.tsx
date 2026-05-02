import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
	applicationName: "Mango",
	title: "Mango",
	description: "A cute 3D avatar chat companion with voice playback.",
	icons: {
		icon: "/logo.svg",
		shortcut: "/logo.svg",
		apple: "/logo.svg",
	},
	openGraph: {
		title: "Mango",
		description: "A cute 3D avatar chat companion with voice playback.",
		siteName: "Mango",
		type: "website",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="font-sans antialiased">
				<TooltipProvider>{children}</TooltipProvider>
			</body>
		</html>
	);
}
