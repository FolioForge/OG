import { OgJob } from "../core/types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().replace("T", " ").replace("Z", " UTC");
}

export function renderJobsPage(input: { jobs: OgJob[]; nextCursor?: string }): string {
  const cards = input.jobs
    .map((job) => {
      const mappedUrl = job.mappedPageUrl ? `<p><strong>Mapped URL:</strong> ${escapeHtml(job.mappedPageUrl)}</p>` : "";
      return `<article class="job-card">
        <img src="${escapeHtml(job.imageUrl)}" alt="${escapeHtml(job.title)}" />
        <div class="meta">
          <h3>${escapeHtml(job.title)}</h3>
          ${job.subtitle ? `<p class="subtitle">${escapeHtml(job.subtitle)}</p>` : ""}
          <p><strong>Job ID:</strong> <code>${escapeHtml(job.id)}</code></p>
          <p><strong>Platform:</strong> ${escapeHtml(job.platform)} | <strong>Template:</strong> ${escapeHtml(job.templateId)}</p>
          <p><strong>Status:</strong> ${escapeHtml(job.status)}</p>
          <p><strong>Created:</strong> ${escapeHtml(formatDate(job.createdAt))}</p>
          ${mappedUrl}
        </div>
      </article>`;
    })
    .join("\n");

  const nextPage =
    input.nextCursor !== undefined
      ? `<a class="next" href="/jobs?cursor=${encodeURIComponent(input.nextCursor)}">Next Page</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OG Jobs</title>
    <style>
      body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; background: linear-gradient(145deg, #f4f7fb, #e9eef8); color: #17212f; }
      .container { max-width: 1120px; margin: 0 auto; padding: 28px 20px 40px; }
      h1 { margin: 0 0 16px; font-size: 28px; letter-spacing: 0.2px; }
      .sub { margin: 0 0 24px; color: #3f4e63; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
      .job-card { border-radius: 16px; overflow: hidden; border: 1px solid #d6ddea; background: #ffffff; box-shadow: 0 10px 25px rgba(5, 20, 44, 0.08); }
      .job-card img { width: 100%; height: auto; display: block; background: #111; }
      .meta { padding: 14px 16px 16px; }
      .meta h3 { margin: 0 0 8px; font-size: 18px; line-height: 1.2; }
      .subtitle { margin: 0 0 10px; color: #3f4e63; }
      .meta p { margin: 4px 0; font-size: 13px; line-height: 1.4; word-break: break-word; }
      code { background: #eef3fb; padding: 1px 6px; border-radius: 8px; }
      .next { display: inline-block; margin-top: 20px; padding: 10px 14px; border-radius: 8px; background: #0d59f2; color: #fff; text-decoration: none; }
      .empty { padding: 24px; border: 1px dashed #b7c3d8; border-radius: 12px; background: #fff; color: #3f4e63; }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>OG Job Library</h1>
      <p class="sub">Latest completed OG generation jobs from the MCP/API pipeline.</p>
      ${input.jobs.length > 0 ? `<section class="grid">${cards}</section>` : `<section class="empty">No jobs yet.</section>`}
      ${nextPage}
    </main>
  </body>
</html>`;
}
