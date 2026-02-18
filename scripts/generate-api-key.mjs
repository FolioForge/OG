import crypto from "node:crypto";

const nameArg = process.argv[2] ?? "default";
const tierArg = (process.argv[3] ?? "outsider").toLowerCase();

if (tierArg !== "internal" && tierArg !== "outsider") {
  process.stderr.write('Tier must be "internal" or "outsider"\n');
  process.exit(1);
}

const random = crypto.randomBytes(24).toString("base64url");
const key = `ogk_${random}`;

process.stdout.write(`API key generated:\n`);
process.stdout.write(`name: ${nameArg}\n`);
process.stdout.write(`tier: ${tierArg}\n`);
process.stdout.write(`key: ${key}\n\n`);
process.stdout.write(`Add to API_KEYS as:\n`);
process.stdout.write(`${nameArg}:${key}:${tierArg}\n`);
