type ProductionConfigCheckOptions = {
	requiresOpenAi?: boolean;
};

type ProductionConfigValidationResult =
	| {
			ok: true;
	  }
	| {
			ok: false;
			clientMessage: string;
			logMessage: string;
			missing: string[];
	  };

const getMissingProductionEnvironmentVariables = ({
	requiresOpenAi = false,
}: ProductionConfigCheckOptions) => {
	const missing: string[] = [];

	if (!process.env.ALLOWED_ORIGINS?.trim()) {
		missing.push("ALLOWED_ORIGINS");
	}

	if (!process.env.SESSION_SIGNING_SECRET?.trim()) {
		missing.push("SESSION_SIGNING_SECRET");
	}

	if (requiresOpenAi && !process.env.OPENAI_API_KEY?.trim()) {
		missing.push("OPENAI_API_KEY");
	}

	return missing;
};

export const validateProductionServerConfig = ({
	requiresOpenAi = false,
}: ProductionConfigCheckOptions = {}): ProductionConfigValidationResult => {
	if (process.env.NODE_ENV !== "production") {
		return {
			ok: true,
		};
	}

	const missing = getMissingProductionEnvironmentVariables({
		requiresOpenAi,
	});

	if (missing.length === 0) {
		return {
			ok: true,
		};
	}

	return {
		ok: false,
		clientMessage: "Server configuration is incomplete.",
		logMessage: `Missing required production configuration: ${missing.join(", ")}.`,
		missing,
	};
};
