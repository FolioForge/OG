import assert from "node:assert/strict";

import { AppConfig } from "../../src/config.js";
import { OgJob } from "../../src/core/types.js";
import { createTempDataDir, ensureFixtureImage, postJson, startApiForTests, startFixtureImageServer } from "./helpers.js";

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export async function runSecurityE2E(): Promise<void> {
  const dataDir = createTempDataDir("og-security-e2e");
  const fixtureImage = await ensureFixtureImage();
  const fixtureServer = await startFixtureImageServer(fixtureImage, 3998);

  const configOverrides: Partial<AppConfig> = {
    requireApiKey: true,
    outsiderRateLimitPerMinute: 1,
    internalRateLimitPerMinute: 0,
    apiKeys: new Map([
      ["test_internal_key", { name: "folioforge", tier: "internal" }],
      ["test_outsider_key", { name: "public", tier: "outsider" }],
    ]),
  };

  const api = await startApiForTests(4014, dataDir, configOverrides);
  const basePayload = {
    source_image_url: "http://127.0.0.1:3998/image.jpg",
    title: "Security Test",
    platform: "og" as const,
  };

  try {
    const unauthorized = await postJson<ErrorResponse>(`${api.baseUrl}/v1/og/jobs`, basePayload);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.error.code, "UNAUTHORIZED");

    const invalidKey = await postJson<ErrorResponse>(`${api.baseUrl}/v1/og/jobs`, basePayload, {
      headers: { "x-api-key": "invalid_key" },
    });
    assert.equal(invalidKey.status, 401);

    const outsiderFirst = await postJson<OgJob>(`${api.baseUrl}/v1/og/jobs`, basePayload, {
      headers: { "x-api-key": "test_outsider_key" },
    });
    assert.equal(outsiderFirst.status, 201);

    const outsiderSecond = await postJson<ErrorResponse>(`${api.baseUrl}/v1/og/jobs`, basePayload, {
      headers: { "x-api-key": "test_outsider_key" },
    });
    assert.equal(outsiderSecond.status, 429);
    assert.equal(outsiderSecond.body.error.code, "RATE_LIMITED");

    const internalFirst = await postJson<OgJob>(`${api.baseUrl}/v1/og/jobs`, basePayload, {
      headers: { "x-api-key": "test_internal_key" },
    });
    assert.equal(internalFirst.status, 201);

    const internalSecond = await postJson<OgJob>(`${api.baseUrl}/v1/og/jobs`, basePayload, {
      headers: { authorization: "Bearer test_internal_key" },
    });
    assert.equal(internalSecond.status, 201);
  } finally {
    await api.stop();
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
  }
}
