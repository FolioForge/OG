import sharp from "sharp";

import { PRESETS } from "./presets.js";
import { AppError } from "./errors.js";
import { Platform, TemplateId } from "./types.js";

interface RenderInput {
  sourceImageBuffer: Buffer;
  title: string;
  subtitle?: string;
  platform: Platform;
  templateId: TemplateId;
}

interface FitTextResult {
  lines: string[];
  fontSize: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapByWidth(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = word;
      continue;
    }

    lines.push(word.slice(0, maxChars));
    current = word.slice(maxChars);
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function clampLineWithEllipsis(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }

  return `${value.slice(0, maxChars - 3)}...`;
}

function fitText(text: string, maxWidthPx: number, maxLines: number, maxFontSize: number, minFontSize: number): FitTextResult {
  const normalized = text.trim().replace(/\s+/g, " ");

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const approxCharWidth = fontSize * 0.56;
    const maxChars = Math.max(10, Math.floor(maxWidthPx / approxCharWidth));
    const lines = wrapByWidth(normalized, maxChars);

    if (lines.length <= maxLines) {
      return { lines, fontSize };
    }
  }

  const approxCharWidth = minFontSize * 0.56;
  const maxChars = Math.max(10, Math.floor(maxWidthPx / approxCharWidth));
  const wrapped = wrapByWidth(normalized, maxChars).slice(0, maxLines);
  const lastIdx = wrapped.length - 1;
  wrapped[lastIdx] = clampLineWithEllipsis(wrapped[lastIdx], maxChars);

  return { lines: wrapped, fontSize: minFontSize };
}

function gradientBottomOverlaySvg(input: {
  width: number;
  height: number;
  title: string;
  subtitle?: string;
}): string {
  const titleFit = fitText(input.title, input.width - 120, 2, 66, 36);
  const subtitleFit = input.subtitle ? fitText(input.subtitle, input.width - 120, 1, 38, 24) : undefined;

  const titleStartY = input.height - 170;
  const titleRows = titleFit.lines
    .map((line, index) => {
      const y = titleStartY + index * Math.ceil(titleFit.fontSize * 1.2);
      return `<text x="60" y="${y}" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="${titleFit.fontSize}" font-weight="700">${escapeXml(
        line,
      )}</text>`;
    })
    .join("");

  const subtitleY = titleStartY + titleFit.lines.length * Math.ceil(titleFit.fontSize * 1.2) + 24;
  const subtitleRow =
    subtitleFit && subtitleFit.lines.length > 0
      ? `<text x="60" y="${subtitleY}" fill="#D9DFE8" font-family="Inter, Arial, sans-serif" font-size="${subtitleFit.fontSize}" font-weight="500">${escapeXml(
          subtitleFit.lines[0],
        )}</text>`
      : "";

  return `<svg width="${input.width}" height="${input.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0)" />
        <stop offset="100%" stop-color="rgba(0,0,0,0.72)" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${input.width}" height="${input.height}" fill="url(#g)" />
    ${titleRows}
    ${subtitleRow}
  </svg>`;
}

function centerDarkOverlaySvg(input: {
  width: number;
  height: number;
  title: string;
  subtitle?: string;
}): string {
  const titleFit = fitText(input.title, input.width - 180, 2, 72, 38);
  const subtitleFit = input.subtitle ? fitText(input.subtitle, input.width - 200, 1, 34, 22) : undefined;

  const blockHeight = titleFit.lines.length * Math.ceil(titleFit.fontSize * 1.18) + (subtitleFit ? subtitleFit.fontSize + 24 : 0);
  const titleStartY = Math.floor((input.height - blockHeight) / 2) + titleFit.fontSize;

  const titleRows = titleFit.lines
    .map((line, index) => {
      const y = titleStartY + index * Math.ceil(titleFit.fontSize * 1.2);
      return `<text x="${input.width / 2}" y="${y}" fill="#FFFFFF" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${titleFit.fontSize}" font-weight="700">${escapeXml(
        line,
      )}</text>`;
    })
    .join("");

  const subtitleY = titleStartY + titleFit.lines.length * Math.ceil(titleFit.fontSize * 1.2) + 18;
  const subtitleRow =
    subtitleFit && subtitleFit.lines.length > 0
      ? `<text x="${input.width / 2}" y="${subtitleY}" fill="#DCE1EA" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${subtitleFit.fontSize}" font-weight="500">${escapeXml(
          subtitleFit.lines[0],
        )}</text>`
      : "";

  return `<svg width="${input.width}" height="${input.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${input.width}" height="${input.height}" fill="rgba(0,0,0,0.48)" />
    ${titleRows}
    ${subtitleRow}
  </svg>`;
}

function buildOverlaySvg(width: number, height: number, templateId: TemplateId, title: string, subtitle?: string): string {
  if (templateId === "gradient-bottom") {
    return gradientBottomOverlaySvg({ width, height, title, subtitle });
  }

  if (templateId === "center-dark") {
    return centerDarkOverlaySvg({ width, height, title, subtitle });
  }

  throw new AppError("INVALID_TEMPLATE", `Unsupported template: ${templateId}`, 400);
}

export async function renderOgImage(input: RenderInput): Promise<{ imageBuffer: Buffer; width: number; height: number }> {
  const preset = PRESETS[input.platform];
  if (!preset) {
    throw new AppError("INVALID_PLATFORM", `Unsupported platform: ${input.platform}`, 400);
  }

  const resized = sharp(input.sourceImageBuffer).resize({
    width: preset.width,
    height: preset.height,
    fit: "cover",
    position: "centre",
  });

  const overlaySvg = buildOverlaySvg(preset.width, preset.height, input.templateId, input.title, input.subtitle);
  const output = await resized
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ compressionLevel: 6 })
    .toBuffer();

  return {
    imageBuffer: output,
    width: preset.width,
    height: preset.height,
  };
}
