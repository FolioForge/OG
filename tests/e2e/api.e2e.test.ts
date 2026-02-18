import assert from "node:assert/strict";

import { OgJob, OgUrlMapping } from "../../src/core/types.js";
import {
  assertFileExists,
  ensureFixtureImage,
  getJson,
  getText,
  postJson,
  startApiForTests,
  startFixtureImageServer,
  createTempDataDir,
} from "./helpers.js";

interface ApiListResponse {
  items: OgJob[];
  nextCursor?: string;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export async function runApiE2E(): Promise<void> {
  const dataDir = createTempDataDir("og-api-e2e");
  const fixtureImage = await ensureFixtureImage();
  const fixtureServer = await startFixtureImageServer(fixtureImage, 3999);
  const api = await startApiForTests(4010, dataDir);

  try {
    const createFromUrl = await postJson<OgJob>(`${api.baseUrl}/v1/og/jobs`, {
      source_image_url: "http://127.0.0.1:3999/image.jpg",
      title: "Pilot Post from URL",
      subtitle: "Using local fixture server",
      platform: "og",
      template_id: "gradient-bottom",
    });
    assert.equal(createFromUrl.status, 201);
    assert.ok(createFromUrl.body.id);
    assert.equal(createFromUrl.body.width, 1200);
    assert.equal(createFromUrl.body.height, 630);
    assertFileExists(createFromUrl.body.outputPath);

    const multipartForm = new FormData();
    multipartForm.set("source_image_file", new File([fixtureImage], "fixture.jpg", { type: "image/jpeg" }));
    multipartForm.set("title", "Upload Source");
    multipartForm.set("subtitle", "Multipart path");
    multipartForm.set("platform", "twitter");
    multipartForm.set("template_id", "center-dark");

    const uploadResponse = await fetch(`${api.baseUrl}/v1/og/jobs`, {
      method: "POST",
      body: multipartForm,
    });
    const uploadBody = (await uploadResponse.json()) as OgJob;
    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadBody.width, 1200);
    assert.equal(uploadBody.height, 675);
    assertFileExists(uploadBody.outputPath);

    const invalidBothForm = new FormData();
    invalidBothForm.set("source_image_file", new File([fixtureImage], "fixture.jpg", { type: "image/jpeg" }));
    invalidBothForm.set("source_image_url", "http://127.0.0.1:3999/image.jpg");
    invalidBothForm.set("title", "invalid");
    const invalidBothResponse = await fetch(`${api.baseUrl}/v1/og/jobs`, {
      method: "POST",
      body: invalidBothForm,
    });
    assert.equal(invalidBothResponse.status, 400);

    const invalidUrl = await postJson<ErrorResponse>(`${api.baseUrl}/v1/og/jobs`, {
      source_image_url: "not a url",
      title: "Bad URL",
    });
    assert.equal(invalidUrl.status, 400);

    const longTitle = await postJson<ErrorResponse>(`${api.baseUrl}/v1/og/jobs`, {
      source_image_url: "http://127.0.0.1:3999/image.jpg",
      title: "x".repeat(141),
    });
    assert.equal(longTitle.status, 400);
    assert.equal(longTitle.body.error.code, "TITLE_TOO_LONG");

    const listResponse = await getJson<ApiListResponse>(`${api.baseUrl}/v1/og/jobs?limit=10`);
    assert.equal(listResponse.status, 200);
    assert.ok(listResponse.body.items.length >= 2);

    const getSingle = await getJson<OgJob>(`${api.baseUrl}/v1/og/jobs/${createFromUrl.body.id}`);
    assert.equal(getSingle.status, 200);
    assert.equal(getSingle.body.id, createFromUrl.body.id);

    const mappedUrl = "https://folioforge.org/blog/pilot-post";
    const mapResponse = await postJson<OgUrlMapping>(`${api.baseUrl}/v1/og/mappings`, {
      page_url: mappedUrl,
      job_id: createFromUrl.body.id,
    });
    assert.equal(mapResponse.status, 200);
    assert.equal(mapResponse.body.pageUrl, mappedUrl);

    const byUrl = await getJson<OgUrlMapping>(`${api.baseUrl}/v1/og/mappings/by-url?url=${encodeURIComponent(mappedUrl)}`);
    assert.equal(byUrl.status, 200);
    assert.equal(byUrl.body.jobId, createFromUrl.body.id);

    const jobsHtml = await getText(`${api.baseUrl}/jobs`);
    assert.equal(jobsHtml.status, 200);
    assert.ok(jobsHtml.body.includes("OG Job Library"));
    assert.ok(jobsHtml.body.includes(createFromUrl.body.id));
    assert.ok(jobsHtml.body.includes("/assets/og/"));
  } finally {
    await api.stop();
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()));
  }
}
