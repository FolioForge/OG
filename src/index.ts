import { startApiServer } from "./api/server.js";

startApiServer().catch((error) => {
  process.stderr.write(`Failed to start OG API server: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
