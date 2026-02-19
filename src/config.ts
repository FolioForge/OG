import fs from "node:fs";
import path from "node:path";

export type ApiKeyTier = "internal" | "outsider";

export interface ApiKeyRecord {
  name: string;
  tier: ApiKeyTier;
}

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  imageDir: string;
  dbPath: string;
  publicBaseUrl: string;
  maxRemoteImageBytes: number;
  remoteFetchTimeoutMs: number;
  allowPrivateSourceImages: boolean;
  apiKeys: Map<string, ApiKeyRecord>;
  requireApiKey: boolean;
  outsiderRateLimitPerMinute: number;
  anonymousRateLimitPerMinute: number;
  internalRateLimitPerMinute: number;
  enableCors: boolean;
  corsOrigin: string;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

function toInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTier(value: string | undefined): ApiKeyTier {
  if (!value || value.toLowerCase() === "outsider") {
    return "outsider";
  }

  if (value.toLowerCase() === "internal") {
    return "internal";
  }

  throw new Error(`Invalid API key tier: ${value}. Use "internal" or "outsider".`);
}

function parseApiKeys(raw: string | undefined): Map<string, ApiKeyRecord> {
  const apiKeys = new Map<string, ApiKeyRecord>();
  if (!raw) {
    return apiKeys;
  }

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    const parts = entry.split(":").map((part) => part.trim());
    if (parts.length < 2 || parts.length > 3) {
      throw new Error(`Invalid API_KEYS entry: "${entry}". Expected format "name:key:tier".`);
    }

    const [name, key, tierRaw] = parts;
    if (!name || !key) {
      throw new Error(`Invalid API_KEYS entry: "${entry}". Name and key are required.`);
    }

    if (apiKeys.has(key)) {
      throw new Error(`Duplicate API key detected in API_KEYS for name "${name}".`);
    }

    apiKeys.set(key, {
      name,
      tier: normalizeTier(tierRaw),
    });
  }

  return apiKeys;
}

export function getConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const cwd = process.cwd();
  const dataDir = overrides.dataDir ?? process.env.DATA_DIR ?? path.join(cwd, "data");
  const imageDir = overrides.imageDir ?? process.env.IMAGE_DIR ?? path.join(dataDir, "og-images");
  const dbPath = overrides.dbPath ?? process.env.DB_PATH ?? path.join(dataDir, "og.db");
  const port = overrides.port ?? toInt(process.env.PORT, 4010);
  const host = overrides.host ?? process.env.HOST ?? "0.0.0.0";
  const publicBaseUrl = overrides.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(imageDir, { recursive: true });
  const apiKeys = overrides.apiKeys ?? parseApiKeys(process.env.API_KEYS);

  return {
    host,
    port,
    dataDir,
    imageDir,
    dbPath,
    publicBaseUrl,
    maxRemoteImageBytes: overrides.maxRemoteImageBytes ?? toInt(process.env.MAX_REMOTE_IMAGE_BYTES, 10 * 1024 * 1024),
    remoteFetchTimeoutMs: overrides.remoteFetchTimeoutMs ?? toInt(process.env.REMOTE_FETCH_TIMEOUT_MS, 8_000),
    allowPrivateSourceImages:
      overrides.allowPrivateSourceImages ?? toBool(process.env.ALLOW_PRIVATE_SOURCE_IMAGES, false),
    apiKeys,
    requireApiKey: overrides.requireApiKey ?? toBool(process.env.REQUIRE_API_KEY, apiKeys.size > 0),
    outsiderRateLimitPerMinute: overrides.outsiderRateLimitPerMinute ?? toInt(process.env.OUTSIDER_RATE_LIMIT_PER_MINUTE, 60),
    anonymousRateLimitPerMinute:
      overrides.anonymousRateLimitPerMinute ?? toInt(process.env.ANONYMOUS_RATE_LIMIT_PER_MINUTE, 20),
    internalRateLimitPerMinute: overrides.internalRateLimitPerMinute ?? toInt(process.env.INTERNAL_RATE_LIMIT_PER_MINUTE, 0),
    enableCors: overrides.enableCors ?? toBool(process.env.ENABLE_CORS, true),
    corsOrigin: overrides.corsOrigin ?? process.env.CORS_ORIGIN ?? "*",
  };
}
