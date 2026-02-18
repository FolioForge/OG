import type { FastifyInstance } from "fastify";

import { OgService } from "../../core/service.js";

export function registerTemplateRoutes(app: FastifyInstance, service: OgService): void {
  app.get("/v1/og/templates", async (_request, reply) => {
    return reply.send(service.getTemplates());
  });
}
