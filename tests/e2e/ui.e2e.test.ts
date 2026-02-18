import assert from "node:assert/strict";

import { OgJob } from "../../src/core/types.js";
import { createTempDataDir, ensureFixtureImage, getText, postJson, startApiForTests } from "./helpers.js";

export async function runUiE2E(): Promise<void> {
  const dataDir = createTempDataDir("og-ui-e2e");
  const api = await startApiForTests(4012, dataDir);
  const fixtureBuffer = await ensureFixtureImage();

  try {
    const create = await postJson<OgJob>(`${api.baseUrl}/v1/og/jobs`, {
      source_image_base64: fixtureBuffer.toString("base64"),
      title: "UI Smoke Test",
      subtitle: "Rendered in /jobs",
    });
    assert.equal(create.status, 201);

    const html = await getText(`${api.baseUrl}/jobs`);
    assert.equal(html.status, 200);
    assert.ok(html.body.includes("OG Job Library"));
    assert.ok(html.body.includes("UI Smoke Test"));
    assert.ok(html.body.includes(create.body.id));
  } finally {
    await api.stop();
  }
}
