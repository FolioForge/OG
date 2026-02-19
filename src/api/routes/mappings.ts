import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { isAppError } from "../../core/errors.js";
import { OgService } from "../../core/service.js";
import { OgUrlMapping } from "../../core/types.js";

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

function withIsoMapping(mapping: OgUrlMapping): OgUrlMapping & { updatedAtIso: string } {
  return {
    ...mapping,
    updatedAtIso: new Date(mapping.updatedAt).toISOString(),
  };
}

export function registerMappingRoutes(app: FastifyInstance, service: OgService): void {
  app.post("/v1/og/mappings", async (request, reply) => {
    try {
      const body = z
        .object({
          page_url: z.string(),
          job_id: z.string(),
        })
        .parse(request.body ?? {});

      const mapping = service.attachOgToUrl(body.page_url, body.job_id);
      return reply.status(200).send(withIsoMapping(mapping));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: "INVALID_REQUEST",
            message: "page_url and job_id are required",
          },
        });
      }
      sendError(reply, error);
    }
  });

  app.get("/v1/og/mappings/by-url", async (request, reply) => {
    try {
      const query = z.object({ url: z.string() }).parse(request.query ?? {});
      const mapping = service.getOgForUrl(query.url);
      return reply.status(200).send(withIsoMapping(mapping));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: "INVALID_REQUEST",
            message: "url query parameter is required",
          },
        });
      }
      sendError(reply, error);
    }
  });
}
