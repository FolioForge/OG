import { runApiE2E } from "./api.e2e.test.js";
import { runMcpE2E } from "./mcp.e2e.test.js";
import { runSecurityE2E } from "./security.e2e.test.js";
import { runUiE2E } from "./ui.e2e.test.js";
import { runSmokeE2E } from "./smoke.test.js";

async function runSuite(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  process.stdout.write(`\n[RUN] ${name}\n`);
  await fn();
  const durationMs = Date.now() - start;
  process.stdout.write(`[PASS] ${name} (${durationMs}ms)\n`);
}

async function main(): Promise<void> {
  await runSuite("API E2E", runApiE2E);
  await runSuite("Security E2E", runSecurityE2E);
  await runSuite("MCP E2E", runMcpE2E);
  await runSuite("UI E2E", runUiE2E);
  await runSuite("Smoke E2E", runSmokeE2E);
  process.stdout.write("\nAll E2E suites passed.\n");
}

main().catch((error) => {
  process.stderr.write(`E2E failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
