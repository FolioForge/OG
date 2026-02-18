import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import { AppConfig, getConfig } from "../config.js";
import { isAppError } from "../core/errors.js";
import { OgService } from "../core/service.js";

function toToolResult(payload: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

function toToolError(error: unknown) {
  if (isAppError(error)) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: {
              code: error.code,
              message: error.message,
              ...error.details,
            },
          }),
        },
      ],
      structuredContent: {
        error: {
          code: error.code,
          message: error.message,
          ...error.details,
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message,
          },
        }),
      },
    ],
    structuredContent: {
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
  };
}

export function createMcpServer(configOverrides: Partial<AppConfig> = {}) {
  const config = getConfig(configOverrides);
  const service = new OgService(config);

  const mcpServer = new McpServer({
    name: "og-image-generator",
    version: "0.1.0",
  });

  mcpServer.registerTool(
    "create_og_image",
    {
      description:
        "Generate a social preview image from a source image URL or base64 image. Supports OG, Twitter, and LinkedIn dimensions.",
      inputSchema: {
        source_image_url: z.string().optional(),
        source_image_base64: z.string().optional(),
        title: z.string(),
        subtitle: z.string().optional(),
        platform: z.enum(["og", "twitter", "linkedin"]).default("og"),
        template_id: z.enum(["gradient-bottom", "center-dark"]).default("gradient-bottom"),
        page_url: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const job = await service.createOgJob({
          sourceImageUrl: args.source_image_url,
          sourceImageBase64: args.source_image_base64,
          title: args.title,
          subtitle: args.subtitle,
          platform: args.platform,
          templateId: args.template_id,
          pageUrl: args.page_url,
        });

        return toToolResult({
          job_id: job.id,
          status: job.status,
          image_url: job.imageUrl,
          width: job.width,
          height: job.height,
          created_at: job.createdAt,
          page_url: job.mappedPageUrl ?? null,
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  mcpServer.registerTool(
    "list_og_jobs",
    {
      description:
        "List previously generated OG image jobs with pagination. Returns metadata including titles, platforms, and image URLs.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
        cursor: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const jobs = service.listJobs({
          limit: args.limit,
          cursor: args.cursor,
        });
        return toToolResult({
          items: jobs.items,
          next_cursor: jobs.nextCursor ?? null,
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  mcpServer.registerTool(
    "get_og_job",
    {
      description: "Get a single OG generation job by job ID.",
      inputSchema: {
        job_id: z.string(),
      },
    },
    async (args) => {
      try {
        const job = service.getJobById(args.job_id);
        return toToolResult(job as unknown as Record<string, unknown>);
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  mcpServer.registerTool(
    "attach_og_to_url",
    {
      description: "Attach an existing OG generation job to a public page URL. Latest mapping per page URL wins.",
      inputSchema: {
        page_url: z.string(),
        job_id: z.string(),
      },
    },
    async (args) => {
      try {
        const mapping = service.attachOgToUrl(args.page_url, args.job_id);
        return toToolResult({
          page_url: mapping.pageUrl,
          job_id: mapping.jobId,
          image_url: mapping.imageUrl,
          updated_at: mapping.updatedAt,
        });
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  return {
    mcpServer,
    service,
  };
}

export async function startMcpServer(configOverrides: Partial<AppConfig> = {}): Promise<void> {
  const { mcpServer } = createMcpServer(configOverrides);
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startMcpServer().catch((error) => {
    process.stderr.write(`Failed to start MCP server: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
