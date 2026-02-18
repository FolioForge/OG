import dns from "node:dns/promises";
import net from "node:net";

import { AppError } from "./errors.js";

interface ResolveSourceInput {
  sourceImageUrl?: string;
  sourceImageBase64?: string;
  sourceImageBuffer?: Buffer;
  sourceFileName?: string;
  maxBytes: number;
  timeoutMs: number;
  allowPrivateNetwork: boolean;
}

interface SourceImageResult {
  buffer: Buffer;
  sourceType: "url" | "base64" | "upload";
  sourceRef: string;
}

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split(".").map((v) => Number.parseInt(v, 10));
  if (octets.length !== 4 || octets.some((v) => Number.isNaN(v))) {
    return true;
  }

  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    if (net.isIP(mapped) === 4) {
      return isPrivateIpv4(mapped);
    }
  }
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

async function assertPublicHost(hostname: string, allowPrivateNetwork: boolean): Promise<void> {
  if (allowPrivateNetwork) {
    return;
  }

  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new AppError("DNS_RESOLUTION_FAILED", `Unable to resolve hostname: ${hostname}`, 400);
  }

  for (const entry of results) {
    if (isPrivateAddress(entry.address)) {
      throw new AppError("PRIVATE_NETWORK_BLOCKED", "Private network addresses are blocked", 400);
    }
  }
}

function normalizeDataUrl(base64OrDataUrl: string): string {
  const trimmed = base64OrDataUrl.trim();
  if (!trimmed.startsWith("data:")) {
    return trimmed;
  }

  const commaIdx = trimmed.indexOf(",");
  if (commaIdx === -1) {
    throw new AppError("INVALID_BASE64", "Invalid data URL format", 400);
  }

  return trimmed.slice(commaIdx + 1);
}

async function readBodyWithLimit(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Buffer> {
  if (!body) {
    throw new AppError("EMPTY_RESPONSE", "Remote image response body was empty", 422);
  }

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    total += value.byteLength;
    if (total > maxBytes) {
      throw new AppError("SOURCE_TOO_LARGE", `Source image exceeded ${maxBytes} bytes`, 422, { maxBytes });
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

async function fetchRemoteImage(
  rawUrl: string,
  maxBytes: number,
  timeoutMs: number,
  allowPrivateNetwork: boolean,
): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError("INVALID_URL", "source_image_url must be a valid URL", 400);
  }

  let currentUrl = url;
  let redirects = 0;

  while (redirects <= 3) {
    if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
      throw new AppError("INVALID_URL_PROTOCOL", "Only http:// and https:// URLs are allowed", 400);
    }

    await assertPublicHost(currentUrl.hostname, allowPrivateNetwork);

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "og-image-generator/0.1",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) {
        throw new AppError("REDIRECT_MISSING_LOCATION", "Redirect response was missing location header", 422);
      }
      currentUrl = new URL(next, currentUrl);
      redirects += 1;
      continue;
    }

    if (!response.ok) {
      throw new AppError("REMOTE_FETCH_FAILED", `Remote image returned HTTP ${response.status}`, 422);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
      throw new AppError("UNSUPPORTED_MIME_TYPE", "Remote image must be png, jpeg, or webp", 422, {
        contentType: contentType ?? "unknown",
      });
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const bytes = Number.parseInt(contentLength, 10);
      if (Number.isFinite(bytes) && bytes > maxBytes) {
        throw new AppError("SOURCE_TOO_LARGE", `Source image exceeded ${maxBytes} bytes`, 422, { maxBytes });
      }
    }

    return readBodyWithLimit(response.body, maxBytes);
  }

  throw new AppError("TOO_MANY_REDIRECTS", "Remote image exceeded redirect limit", 422);
}

export async function resolveSourceImage(input: ResolveSourceInput): Promise<SourceImageResult> {
  const sources = [
    input.sourceImageUrl ? "url" : null,
    input.sourceImageBase64 ? "base64" : null,
    input.sourceImageBuffer ? "buffer" : null,
  ].filter(Boolean);

  if (sources.length !== 1) {
    throw new AppError(
      "INVALID_SOURCE",
      "Provide exactly one image source: source_image_url, source_image_base64, or source_image_file",
      400,
    );
  }

  if (input.sourceImageBuffer) {
    if (input.sourceImageBuffer.length > input.maxBytes) {
      throw new AppError("SOURCE_TOO_LARGE", `Uploaded image exceeded ${input.maxBytes} bytes`, 422);
    }
    return {
      buffer: input.sourceImageBuffer,
      sourceType: "upload",
      sourceRef: input.sourceFileName ?? "uploaded-file",
    };
  }

  if (input.sourceImageBase64) {
    const normalized = normalizeDataUrl(input.sourceImageBase64);
    let decoded: Buffer;
    try {
      decoded = Buffer.from(normalized, "base64");
    } catch {
      throw new AppError("INVALID_BASE64", "source_image_base64 must be valid base64", 400);
    }
    if (decoded.length === 0) {
      throw new AppError("INVALID_BASE64", "source_image_base64 decoded to empty payload", 400);
    }
    if (decoded.length > input.maxBytes) {
      throw new AppError("SOURCE_TOO_LARGE", `Base64 image exceeded ${input.maxBytes} bytes`, 422);
    }
    return {
      buffer: decoded,
      sourceType: "base64",
      sourceRef: "base64-inline",
    };
  }

  const remoteBuffer = await fetchRemoteImage(
    input.sourceImageUrl!,
    input.maxBytes,
    input.timeoutMs,
    input.allowPrivateNetwork,
  );

  return {
    buffer: remoteBuffer,
    sourceType: "url",
    sourceRef: input.sourceImageUrl!,
  };
}
