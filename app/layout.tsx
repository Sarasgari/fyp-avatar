import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
	title: "Avatar Assistant",
	description:
		"An expressive AI chat assistant with voice playback and a 3D avatar.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body className="font-sans antialiased">
				<TooltipProvider>{children}</TooltipProvider>
			</body>
		</html>
	);
}
