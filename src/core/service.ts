import { nanoid } from "nanoid";

import { AppConfig, getConfig } from "../config.js";
import { OgRepository } from "../storage/database.js";
import { OgFileStorage } from "../storage/filesystem.js";
import { AppError } from "./errors.js";
import { resolveSourceImage } from "./image-source.js";
import { PRESETS } from "./presets.js";
import { renderOgImage } from "./renderer.js";
import { TEMPLATES } from "./templates.js";
import { CreateJobInput, ListJobsInput, ListJobsResult, OgJob, OgUrlMapping, PLATFORMS, TEMPLATE_IDS } from "./types.js";

function sanitizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizePageUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError("INVALID_PAGE_URL", "page_url must be a valid URL", 400);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AppError("INVALID_PAGE_URL", "page_url must use http or https", 400);
  }

  parsed.hash = "";
  return parsed.toString();
}

export class OgService {
  private readonly config: AppConfig;
  private readonly repository: OgRepository;
  private readonly storage: OgFileStorage;

  constructor(configOverrides: Partial<AppConfig> = {}) {
    this.config = getConfig(configOverrides);
    this.repository = new OgRepository(this.config.dbPath);
    this.storage = new OgFileStorage(this.config.imageDir, this.config.publicBaseUrl);
  }

  async createOgJob(input: CreateJobInput): Promise<OgJob> {
    const title = sanitizeOptionalString(input.title);
    if (!title) {
      throw new AppError("TITLE_REQUIRED", "title is required", 400);
    }
    if (title.length > 140) {
      throw new AppError("TITLE_TOO_LONG", "Title exceeds 140 characters", 400, { max: 140 });
    }

    const subtitle = sanitizeOptionalString(input.subtitle);
    if (subtitle && subtitle.length > 120) {
      throw new AppError("SUBTITLE_TOO_LONG", "Subtitle exceeds 120 characters", 400, { max: 120 });
    }

    const platform = input.platform ?? "og";
    if (!PLATFORMS.includes(platform)) {
      throw new AppError("INVALID_PLATFORM", `platform must be one of: ${PLATFORMS.join(", ")}`, 400);
    }

    const templateId = input.templateId ?? "gradient-bottom";
    if (!TEMPLATE_IDS.includes(templateId)) {
      throw new AppError("INVALID_TEMPLATE", `template_id must be one of: ${TEMPLATE_IDS.join(", ")}`, 400);
    }

    const source = await resolveSourceImage({
      sourceImageUrl: sanitizeOptionalString(input.sourceImageUrl),
      sourceImageBase64: sanitizeOptionalString(input.sourceImageBase64),
      sourceImageBuffer: input.sourceImageBuffer,
      sourceFileName: sanitizeOptionalString(input.sourceFileName),
      maxBytes: this.config.maxRemoteImageBytes,
      timeoutMs: this.config.remoteFetchTimeoutMs,
      allowPrivateNetwork: this.config.allowPrivateSourceImages,
    });

    const rendered = await renderOgImage({
      sourceImageBuffer: source.buffer,
      title,
      subtitle,
      platform,
      templateId,
    });

    const id = nanoid(14);
    const saved = this.storage.savePng(id, rendered.imageBuffer);
    const createdAt = Date.now();

    const job: OgJob = {
      id,
      sourceType: source.sourceType,
      sourceRef: source.sourceRef,
      title,
      subtitle: subtitle ?? null,
      platform,
      templateId,
      outputPath: saved.outputPath,
      imageUrl: saved.imageUrl,
      width: rendered.width,
      height: rendered.height,
      status: "completed",
      errorMessage: null,
      createdAt,
      mappedPageUrl: null,
    };
    this.repository.insertJob(job);

    const normalizedPageUrl = sanitizeOptionalString(input.pageUrl);
    if (normalizedPageUrl) {
      const mapping = this.attachOgToUrl(normalizedPageUrl, job.id);
      job.mappedPageUrl = mapping.pageUrl;
    }

    return job;
  }

  listJobs(input: ListJobsInput): ListJobsResult {
    return this.repository.listJobs(input.limit ?? 20, input.cursor);
  }

  getJobById(jobId: string): OgJob {
    const job = this.repository.getJobById(jobId);
    if (!job) {
      throw new AppError("JOB_NOT_FOUND", `No job found for id: ${jobId}`, 404);
    }
    return job;
  }

  attachOgToUrl(pageUrl: string, jobId: string): OgUrlMapping {
    const job = this.repository.getJobById(jobId);
    if (!job) {
      throw new AppError("JOB_NOT_FOUND", `No job found for id: ${jobId}`, 404);
    }

    const normalized = normalizePageUrl(pageUrl);
    return this.repository.attachOgToUrl(normalized, jobId, job.imageUrl);
  }

  getOgForUrl(pageUrl: string): OgUrlMapping {
    const normalized = normalizePageUrl(pageUrl);
    const mapping = this.repository.getMappingByUrl(normalized);
    if (!mapping) {
      throw new AppError("MAPPING_NOT_FOUND", `No mapping found for URL: ${normalized}`, 404);
    }
    return mapping;
  }

  getTemplates(): Array<{ id: string; name: string; description: string }> {
    return [...TEMPLATES];
  }

  getPresets(): Array<{ id: string; width: number; height: number }> {
    return Object.entries(PRESETS).map(([id, size]) => ({
      id,
      width: size.width,
      height: size.height,
    }));
  }

  close(): void {
    this.repository.close();
  }
}
