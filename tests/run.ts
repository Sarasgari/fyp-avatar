import { runThreadPersistenceTests } from "./lib/thread-persistence.test";
import { runApiTests } from "./server/api.test";
import { runSessionTests } from "./server/session.test";

const main = async () => {
	await runApiTests();
	await runSessionTests();
	await runThreadPersistenceTests();
};

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
