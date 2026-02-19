import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError, isAppError } from "../../core/errors.js";
import { OgService } from "../../core/service.js";
import { OgJob } from "../../core/types.js";

const listJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

const createJobJsonSchema = z.object({
  source_image_url: z.string().optional(),
  source_image_base64: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  platform: z.enum(["og", "twitter", "linkedin"]).optional(),
  template_id: z.enum(["gradient-bottom", "center-dark"]).optional(),
  page_url: z.string().optional(),
});

function sendError(reply: FastifyReply, error: unknown): void {
  if (isAppError(error)) {
    void reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...error.details,
      },
    });
    return;
  }

  void reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    },
  });
}

async function parseMultipartBody(request: FastifyRequest): Promise<{
  sourceImageBuffer?: Buffer;
  sourceFileName?: string;
  sourceImageUrl?: string;
  title?: string;
  subtitle?: string;
  platform?: "og" | "twitter" | "linkedin";
  templateId?: "gradient-bottom" | "center-dark";
  pageUrl?: string;
}> {
  const parts = request.parts();
  const fields = new Map<string, string>();
  let sourceImageBuffer: Buffer | undefined;
  let sourceFileName: string | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname !== "source_image_file") {
        throw new AppError("INVALID_FILE_FIELD", "Use source_image_file as the multipart file field name", 400);
      }
      if (sourceImageBuffer) {
        throw new AppError("MULTIPLE_FILES_NOT_SUPPORTED", "Only one source_image_file is allowed", 400);
      }
      sourceImageBuffer = await part.toBuffer();
      sourceFileName = part.filename;
      continue;
    }

    fields.set(part.fieldname, String(part.value));
  }

  return {
    sourceImageBuffer,
    sourceFileName,
    sourceImageUrl: fields.get("source_image_url"),
    title: fields.get("title"),
    subtitle: fields.get("subtitle"),
    platform: fields.get("platform") as "og" | "twitter" | "linkedin" | undefined,
    templateId: fields.get("template_id") as "gradient-bottom" | "center-dark" | undefined,
    pageUrl: fields.get("page_url"),
  };
}

function withIsoJob(job: OgJob): OgJob & { createdAtIso: string } {
  return {
    ...job,
    createdAtIso: new Date(job.createdAt).toISOString(),
  };
}

export function registerJobRoutes(app: FastifyInstance, service: OgService): void {
  app.post("/v1/og/jobs", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const form = await parseMultipartBody(request);
        const result = await service.createOgJob({
          sourceImageUrl: form.sourceImageUrl,
          sourceImageBuffer: form.sourceImageBuffer,
          sourceFileName: form.sourceFileName,
          title: form.title ?? "",
          subtitle: form.subtitle,
          platform: form.platform,
          templateId: form.templateId,
          pageUrl: form.pageUrl,
        });
        return reply.status(201).send(withIsoJob(result));
      }

      const body = createJobJsonSchema.parse(request.body ?? {});
      const result = await service.createOgJob({
        sourceImageUrl: body.source_image_url,
        sourceImageBase64: body.source_image_base64,
        title: body.title,
        subtitle: body.subtitle,
        platform: body.platform,
        templateId: body.template_id,
        pageUrl: body.page_url,
      });
      return reply.status(201).send(withIsoJob(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: "INVALID_REQUEST",
            message: "Request body failed validation",
            issues: error.issues,
          },
        });
      }
      sendError(reply, error);
    }
  });

  app.get("/v1/og/jobs", async (request, reply) => {
    try {
      const query = listJobsQuerySchema.parse(request.query ?? {});
      const results = service.listJobs(query);
      return reply.send({
        items: results.items.map((job) => withIsoJob(job)),
        nextCursor: results.nextCursor,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: "INVALID_QUERY",
            message: "Invalid query parameters",
            issues: error.issues,
          },
        });
      }
      sendError(reply, error);
    }
  });

  app.get("/v1/og/jobs/:jobId", async (request, reply) => {
    try {
      const params = z.object({ jobId: z.string() }).parse(request.params);
      const job = service.getJobById(params.jobId);
      return reply.send(withIsoJob(job));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: "INVALID_JOB_ID",
            message: "jobId is required",
          },
        });
      }
      sendError(reply, error);
    }
  });
}
