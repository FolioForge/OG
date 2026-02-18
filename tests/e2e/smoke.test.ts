import assert from "node:assert/strict";
import path from "node:path";

import { OgService } from "../../src/core/service.js";
import { createTempDataDir, ensureFixtureImage } from "./helpers.js";

export async function runSmokeE2E(): Promise<void> {
  const dataDir = createTempDataDir("og-smoke-e2e");
  const fixtureBuffer = await ensureFixtureImage();
  const base64 = fixtureBuffer.toString("base64");

  const overrides = {
    dataDir,
    imageDir: path.join(dataDir, "og-images"),
    dbPath: path.join(dataDir, "og.db"),
    publicBaseUrl: "http://127.0.0.1:4013",
    allowPrivateSourceImages: true,
  };

  const service = new OgService(overrides);
  for (let i = 0; i < 20; i += 1) {
    const job = await service.createOgJob({
      sourceImageBase64: base64,
      title: `Smoke Job ${i + 1}`,
      platform: i % 2 === 0 ? "og" : "twitter",
    });
    assert.ok(job.id);
  }
  service.close();

  const restartedService = new OgService(overrides);
  const listed = restartedService.listJobs({ limit: 25 });
  assert.equal(listed.items.length, 20);
  restartedService.close();
}
