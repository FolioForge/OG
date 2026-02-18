import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { ApiKeyTier, AppConfig } from "../config.js";

type RequestTier = ApiKeyTier | "anonymous";

interface Bucket {
  used: number;
  resetAtMs: number;
}

function parseBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function getApiKeyFromRequest(request: FastifyRequest): string | undefined {
  const headerValue = request.headers["x-api-key"];
  const fromHeader = typeof headerValue === "string" ? headerValue.trim() : undefined;
  if (fromHeader) {
    return fromHeader;
  }

  return parseBearerToken(request.headers.authorization);
}

function getLimitForTier(config: AppConfig, tier: RequestTier): number {
  if (tier === "internal") {
    return config.internalRateLimitPerMinute;
  }
  if (tier === "outsider") {
    return config.outsiderRateLimitPerMinute;
  }
  return config.anonymousRateLimitPerMinute;
}

function setRateLimitHeaders(reply: FastifyReply, limit: number, remaining: number, resetAtMs: number): void {
  reply.header("x-rate-limit-limit", String(limit));
  reply.header("x-rate-limit-remaining", String(Math.max(remaining, 0)));
  reply.header("x-rate-limit-reset", String(Math.floor(resetAtMs / 1000)));
}

function sendAuthError(reply: FastifyReply): void {
  void reply.status(401).send({
    error: {
      code: "UNAUTHORIZED",
      message: "Missing or invalid API key",
    },
  });
}

function sendRateLimitError(reply: FastifyReply, resetAtMs: number): void {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
  reply.header("retry-after", String(retryAfterSeconds));
  void reply.status(429).send({
    error: {
      code: "RATE_LIMITED",
      message: "Rate limit exceeded",
      retry_after_seconds: retryAfterSeconds,
    },
  });
}

export function registerApiSecurity(app: FastifyInstance, config: AppConfig): void {
  const buckets = new Map<string, Bucket>();
  const windowMs = 60_000;

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/og/")) {
      return;
    }

    const apiKey = getApiKeyFromRequest(request);
    const keyRecord = apiKey ? config.apiKeys.get(apiKey) : undefined;

    if (apiKey && !keyRecord) {
      sendAuthError(reply);
      return reply;
    }

    if (config.requireApiKey && !keyRecord) {
      sendAuthError(reply);
      return reply;
    }

    const tier: RequestTier = keyRecord?.tier ?? "anonymous";
    reply.header("x-api-key-tier", tier);
    if (keyRecord) {
      reply.header("x-api-key-name", keyRecord.name);
    }

    const limit = getLimitForTier(config, tier);
    if (limit <= 0) {
      return;
    }

    const identity = keyRecord?.name ?? request.ip;
    const bucketKey = `${tier}:${identity}`;
    const now = Date.now();

    const existing = buckets.get(bucketKey);
    let bucket: Bucket;
    if (!existing || now >= existing.resetAtMs) {
      bucket = {
        used: 0,
        resetAtMs: now + windowMs,
      };
      buckets.set(bucketKey, bucket);
    } else {
      bucket = existing;
    }

    if (bucket.used >= limit) {
      setRateLimitHeaders(reply, limit, 0, bucket.resetAtMs);
      sendRateLimitError(reply, bucket.resetAtMs);
      return reply;
    }

    bucket.used += 1;
    const remaining = limit - bucket.used;
    setRateLimitHeaders(reply, limit, remaining, bucket.resetAtMs);
  });

  app.addHook("onResponse", async () => {
    const now = Date.now();
    for (const [bucketKey, bucket] of buckets.entries()) {
      if (now >= bucket.resetAtMs) {
        buckets.delete(bucketKey);
      }
    }
  });
}
