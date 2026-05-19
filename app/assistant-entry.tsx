"use client";

import { useEffect, useState } from "react";
import { Assistant } from "./assistant";

const AssistantLoadingShell = () => <div className="min-h-screen bg-sky-100" />;

export function AssistantEntry() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return mounted ? <Assistant /> : <AssistantLoadingShell />;
}
