export const PLATFORMS = ["og", "twitter", "linkedin"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TEMPLATE_IDS = ["gradient-bottom", "center-dark"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type SourceType = "url" | "upload" | "base64";
export type JobStatus = "completed" | "failed";

export interface OgJob {
  id: string;
  sourceType: SourceType;
  sourceRef: string;
  title: string;
  subtitle: string | null;
  platform: Platform;
  templateId: TemplateId;
  outputPath: string;
  imageUrl: string;
  width: number;
  height: number;
  status: JobStatus;
  errorMessage: string | null;
  createdAt: number;
  mappedPageUrl?: string | null;
}

export interface OgUrlMapping {
  pageUrl: string;
  jobId: string;
  imageUrl: string;
  updatedAt: number;
}

export interface CreateJobInput {
  title: string;
  subtitle?: string;
  platform?: Platform;
  templateId?: TemplateId;
  pageUrl?: string;
  sourceImageUrl?: string;
  sourceImageBase64?: string;
  sourceImageBuffer?: Buffer;
  sourceFileName?: string;
}

export interface ListJobsInput {
  limit?: number;
  cursor?: string;
}

export interface ListJobsResult {
  items: OgJob[];
  nextCursor?: string;
}
