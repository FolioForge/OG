import assert from "node:assert/strict";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { OgUrlMapping } from "../../src/core/types.js";
import { createTempDataDir, ensureFixtureImage, getJson, startApiForTests } from "./helpers.js";

interface ToolResult {
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function runMcpE2E(): Promise<void> {
  const dataDir = createTempDataDir("og-mcp-e2e");
  const api = await startApiForTests(4011, dataDir);
  const fixtureBuffer = await ensureFixtureImage();
  const fixtureBase64 = fixtureBuffer.toString("base64");

  const client = new Client({
    name: "og-e2e-client",
    version: "0.1.0",
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", path.join(process.cwd(), "src/mcp/server.ts")],
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      IMAGE_DIR: path.join(dataDir, "og-images"),
      DB_PATH: path.join(dataDir, "og.db"),
      PUBLIC_BASE_URL: api.baseUrl,
      ALLOW_PRIVATE_SOURCE_IMAGES: "true",
    } as Record<string, string>,
    stderr: "pipe",
  });

  try {
    await client.connect(transport);

    const createResult = (await client.callTool({
      name: "create_og_image",
      arguments: {
        source_image_base64: fixtureBase64,
        title: "MCP Pilot",
        subtitle: "Created from tool",
        platform: "linkedin",
      },
    })) as ToolResult;
    assert.equal(createResult.isError, undefined);
    const created = asObject(createResult.structuredContent);
    assert.ok(created.job_id);
    assert.equal(created.width, 1200);
    assert.equal(created.height, 627);

    const listResult = (await client.callTool({
      name: "list_og_jobs",
      arguments: {
        limit: 10,
      },
    })) as ToolResult;
    const listed = asObject(listResult.structuredContent);
    assert.ok(Array.isArray(listed.items));
    assert.ok((listed.items as unknown[]).length >= 1);

    const jobId = String(created.job_id);
    const getResult = (await client.callTool({
      name: "get_og_job",
      arguments: {
        job_id: jobId,
      },
    })) as ToolResult;
    const fetched = asObject(getResult.structuredContent);
    assert.equal(fetched.id, jobId);

    const pageUrl = "https://folioforge.org/blog/mcp-check";
    const attachResult = (await client.callTool({
      name: "attach_og_to_url",
      arguments: {
        page_url: pageUrl,
        job_id: jobId,
      },
    })) as ToolResult;
    const mapped = asObject(attachResult.structuredContent);
    assert.equal(mapped.page_url, pageUrl);
    assert.equal(mapped.job_id, jobId);

    const mapping = await getJson<OgUrlMapping>(`${api.baseUrl}/v1/og/mappings/by-url?url=${encodeURIComponent(pageUrl)}`);
    assert.equal(mapping.status, 200);
    assert.equal(mapping.body.jobId, jobId);

    const badResult = (await client.callTool({
      name: "create_og_image",
      arguments: {
        title: "x".repeat(141),
        source_image_base64: fixtureBase64,
      },
    })) as ToolResult;
    assert.equal(badResult.isError, true);
    const badContent = asObject(badResult.structuredContent);
    assert.equal(asObject(badContent.error).code, "TITLE_TOO_LONG");
  } finally {
    await transport.close();
    await api.stop();
  }
}
