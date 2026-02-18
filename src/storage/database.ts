import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { ListJobsResult, OgJob, OgUrlMapping } from "../core/types.js";

interface JobRow {
  id: string;
  source_type: string;
  source_ref: string;
  title: string;
  subtitle: string | null;
  platform: string;
  template_id: string;
  output_path: string;
  image_url: string;
  width: number;
  height: number;
  status: string;
  error_message: string | null;
  created_at: number;
}

function toJob(row: JobRow, mappedPageUrl?: string | null): OgJob {
  return {
    id: row.id,
    sourceType: row.source_type as OgJob["sourceType"],
    sourceRef: row.source_ref,
    title: row.title,
    subtitle: row.subtitle,
    platform: row.platform as OgJob["platform"],
    templateId: row.template_id as OgJob["templateId"],
    outputPath: row.output_path,
    imageUrl: row.image_url,
    width: row.width,
    height: row.height,
    status: row.status as OgJob["status"],
    errorMessage: row.error_message,
    createdAt: row.created_at,
    mappedPageUrl: mappedPageUrl ?? null,
  };
}

export class OgRepository {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS og_jobs (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_ref TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        platform TEXT NOT NULL,
        template_id TEXT NOT NULL,
        output_path TEXT NOT NULL,
        image_url TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS url_mappings (
        page_url TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES og_jobs(id),
        image_url TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  insertJob(job: OgJob): void {
    const stmt = this.db.prepare(`
      INSERT INTO og_jobs (
        id, source_type, source_ref, title, subtitle, platform, template_id,
        output_path, image_url, width, height, status, error_message, created_at
      ) VALUES (
        @id, @sourceType, @sourceRef, @title, @subtitle, @platform, @templateId,
        @outputPath, @imageUrl, @width, @height, @status, @errorMessage, @createdAt
      )
    `);
    stmt.run(job);
  }

  getJobById(id: string): OgJob | null {
    const jobRow = this.db
      .prepare(
        `
        SELECT * FROM og_jobs
        WHERE id = ?
      `,
      )
      .get(id) as JobRow | undefined;
    if (!jobRow) {
      return null;
    }

    const mapping = this.db
      .prepare("SELECT page_url FROM url_mappings WHERE job_id = ? ORDER BY updated_at DESC LIMIT 1")
      .get(id) as { page_url: string } | undefined;

    return toJob(jobRow, mapping?.page_url ?? null);
  }

  listJobs(limit: number, cursor?: string): ListJobsResult {
    const safeLimit = Math.max(1, Math.min(100, limit));
    const nextBatchSize = safeLimit + 1;
    const cursorNum = cursor ? Number.parseInt(cursor, 10) : undefined;

    let rows: JobRow[];
    if (cursorNum && Number.isFinite(cursorNum)) {
      rows = this.db
        .prepare(
          `
          SELECT * FROM og_jobs
          WHERE created_at < ?
          ORDER BY created_at DESC
          LIMIT ?
        `,
        )
        .all(cursorNum, nextBatchSize) as JobRow[];
    } else {
      rows = this.db
        .prepare(
          `
          SELECT * FROM og_jobs
          ORDER BY created_at DESC
          LIMIT ?
        `,
        )
        .all(nextBatchSize) as JobRow[];
    }

    const hasMore = rows.length > safeLimit;
    const selected = hasMore ? rows.slice(0, safeLimit) : rows;
    const ids = selected.map((row) => row.id);

    const mapRows =
      ids.length > 0
        ? (this.db
            .prepare(
              `
              SELECT job_id, page_url
              FROM url_mappings
              WHERE job_id IN (${ids.map(() => "?").join(",")})
              ORDER BY updated_at DESC
            `,
            )
            .all(...ids) as { job_id: string; page_url: string }[])
        : [];

    const mappingByJobId = new Map<string, string>();
    for (const row of mapRows) {
      if (!mappingByJobId.has(row.job_id)) {
        mappingByJobId.set(row.job_id, row.page_url);
      }
    }

    return {
      items: selected.map((row) => toJob(row, mappingByJobId.get(row.id) ?? null)),
      nextCursor: hasMore ? String(selected[selected.length - 1].created_at) : undefined,
    };
  }

  attachOgToUrl(pageUrl: string, jobId: string, imageUrl: string): OgUrlMapping {
    const updatedAt = Date.now();
    this.db
      .prepare(
        `
        INSERT INTO url_mappings (page_url, job_id, image_url, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(page_url) DO UPDATE SET
          job_id = excluded.job_id,
          image_url = excluded.image_url,
          updated_at = excluded.updated_at
      `,
      )
      .run(pageUrl, jobId, imageUrl, updatedAt);

    return {
      pageUrl,
      jobId,
      imageUrl,
      updatedAt,
    };
  }

  getMappingByUrl(pageUrl: string): OgUrlMapping | null {
    const row = this.db
      .prepare(
        `
        SELECT page_url, job_id, image_url, updated_at
        FROM url_mappings
        WHERE page_url = ?
      `,
      )
      .get(pageUrl) as
      | {
          page_url: string;
          job_id: string;
          image_url: string;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      pageUrl: row.page_url,
      jobId: row.job_id,
      imageUrl: row.image_url,
      updatedAt: row.updated_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
