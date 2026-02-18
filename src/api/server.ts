import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import Fastify, { FastifyInstance } from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AppConfig, getConfig } from "../config.js";
import { OgService } from "../core/service.js";
import { renderJobsPage } from "../ui/jobs-page.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerMappingRoutes } from "./routes/mappings.js";
import { registerPresetRoutes } from "./routes/presets.js";
import { registerApiSecurity } from "./security.js";
import { registerTemplateRoutes } from "./routes/templates.js";

interface BuildApiServerOptions {
  configOverrides?: Partial<AppConfig>;
  service?: OgService;
}

export async function buildApiServer(options: BuildApiServerOptions = {}): Promise<{
  app: FastifyInstance;
  service: OgService;
  config: AppConfig;
}> {
  const config = getConfig(options.configOverrides);
  const service = options.service ?? new OgService(config);

  const app = Fastify({
    logger: false,
    bodyLimit: config.maxRemoteImageBytes * 2,
    trustProxy: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.maxRemoteImageBytes,
      files: 1,
    },
  });

  await app.register(staticPlugin, {
    root: path.resolve(config.imageDir),
    prefix: "/assets/og/",
    decorateReply: false,
    cacheControl: false,
    maxAge: "5m",
  });

  app.get("/healthz", async (_request, reply) => {
    return reply.send({
      ok: true,
      auth_required: config.requireApiKey,
      configured_api_keys: config.apiKeys.size,
    });
  });

  registerApiSecurity(app, config);

  registerJobRoutes(app, service);
  registerMappingRoutes(app, service);
  registerTemplateRoutes(app, service);
  registerPresetRoutes(app, service);

  app.get("/jobs", async (request, reply) => {
    const limit = Number.parseInt(String((request.query as Record<string, string> | undefined)?.limit ?? "20"), 10);
    const cursor = (request.query as Record<string, string> | undefined)?.cursor;
    const jobs = service.listJobs({
      limit: Number.isFinite(limit) ? limit : 20,
      cursor: cursor || undefined,
    });
    return reply.type("text/html; charset=utf-8").send(
      renderJobsPage({
        jobs: jobs.items,
        nextCursor: jobs.nextCursor,
      }),
    );
  });

  app.get("/jobs/:jobId", async (request, reply) => {
    const params = request.params as { jobId: string };
    const job = service.getJobById(params.jobId);
    return reply.type("text/html; charset=utf-8").send(
      renderJobsPage({
        jobs: [job],
      }),
    );
  });

  app.addHook("onClose", async () => {
    service.close();
  });

  return { app, service, config };
}

export async function startApiServer(configOverrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
  const { app, config } = await buildApiServer({ configOverrides });
  await app.listen({ host: config.host, port: config.port });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startApiServer().catch((error) => {
    process.stderr.write(`Failed to start API server: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
