import { runPreferencesTests } from "./lib/preferences.test";
import { runThreadPersistenceTests } from "./lib/thread-persistence.test";
import { runApiTests } from "./server/api.test";
import { runAuthTests } from "./server/auth.test";
import { runPasswordResetStoreTests } from "./server/password-reset-store.test";
import { runProductionConfigTests } from "./server/production-config.test";
import { runSessionTests } from "./server/session.test";
import { runThreadStoreTests } from "./server/thread-store.test";
import { runUserStoreTests } from "./server/user-store.test";

const main = async () => {
	await runApiTests();
	await runAuthTests();
	await runPasswordResetStoreTests();
	await runPreferencesTests();
	await runProductionConfigTests();
	await runSessionTests();
	await runThreadStoreTests();
	await runThreadPersistenceTests();
	await runUserStoreTests();
};

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
