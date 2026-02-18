import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { buildApiServer } from "../../src/api/server.js";
import { AppConfig } from "../../src/config.js";

export function createTempDataDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

export async function ensureFixtureImage(): Promise<Buffer> {
  const fixturesDir = path.join(process.cwd(), "fixtures");
  const fixturePath = path.join(fixturesDir, "test-image.jpg");
  fs.mkdirSync(fixturesDir, { recursive: true });

  if (!fs.existsSync(fixturePath)) {
    const buffer = await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 24, g: 86, b: 175 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    fs.writeFileSync(fixturePath, buffer);
  }

  return fs.readFileSync(fixturePath);
}

export async function startFixtureImageServer(imageBuffer: Buffer, port = 3999): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    if (request.url === "/image.jpg") {
      response.statusCode = 200;
      response.setHeader("content-type", "image/jpeg");
      response.end(imageBuffer);
      return;
    }
    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return server;
}

export async function startApiForTests(
  port: number,
  dataDir: string,
  overrides: Partial<AppConfig> = {},
): Promise<{
  baseUrl: string;
  stop: () => Promise<void>;
}> {
  const configOverrides: Partial<AppConfig> = {
    host: "127.0.0.1",
    port,
    dataDir,
    imageDir: path.join(dataDir, "og-images"),
    dbPath: path.join(dataDir, "og.db"),
    publicBaseUrl: `http://127.0.0.1:${port}`,
    allowPrivateSourceImages: true,
    ...overrides,
  };

  const { app } = await buildApiServer({ configOverrides });
  await app.listen({ host: "127.0.0.1", port });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      await app.close();
    },
  };
}

function toHeaders(input?: HeadersInit): Record<string, string> {
  if (!input) {
    return {};
  }
  return Object.fromEntries(new Headers(input).entries());
}

export async function postJson<T>(
  url: string,
  payload: unknown,
  options?: {
    headers?: HeadersInit;
  },
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...toHeaders(options?.headers),
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

export async function getJson<T>(
  url: string,
  options?: {
    headers?: HeadersInit;
  },
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, {
    headers: toHeaders(options?.headers),
  });
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

export async function getText(url: string): Promise<{ status: number; body: string }> {
  const response = await fetch(url);
  const body = await response.text();
  return { status: response.status, body };
}

export function assertFileExists(filePath: string): void {
  assert.equal(fs.existsSync(filePath), true, `Expected file to exist: ${filePath}`);
}
