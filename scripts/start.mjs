import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { demoTrackerDatabaseUrl } from "./database-url.mjs";

const require = createRequire(import.meta.url);

async function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
    const terminate = () => child.kill("SIGTERM");
    process.once("SIGTERM", terminate);
    process.once("SIGINT", terminate);
    const cleanup = () => {
      process.removeListener("SIGTERM", terminate);
      process.removeListener("SIGINT", terminate);
    };
    child.once("error", (error) => { cleanup(); reject(error); });
    child.once("exit", (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(`Startup step failed (${signal ?? code}).`));
    });
  });
}

try {
  process.env.DATABASE_URL = demoTrackerDatabaseUrl(process.env.DATABASE_URL);
  console.log("Using the demo_tracker database schema.");
  const prismaCli = require.resolve("prisma/build/index.js");
  await run([prismaCli, "migrate", "deploy"]);
  // Direct Node startup does not add node_modules/.bin to PATH like npm/npx.
  await run([require.resolve("tsx/cli"), "prisma/seed.ts"]);
  await run(["server.js"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
