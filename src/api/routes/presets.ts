import type { FastifyInstance } from "fastify";

import { OgService } from "../../core/service.js";

export function registerPresetRoutes(app: FastifyInstance, service: OgService): void {
  app.get("/v1/og/presets", async (_request, reply) => {
    return reply.send(service.getPresets());
  });
}
