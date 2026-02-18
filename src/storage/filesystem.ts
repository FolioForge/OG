import fs from "node:fs";
import path from "node:path";

export class OgFileStorage {
  private readonly imageDir: string;
  private readonly publicBaseUrl: string;

  constructor(imageDir: string, publicBaseUrl: string) {
    this.imageDir = imageDir;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
    fs.mkdirSync(this.imageDir, { recursive: true });
  }

  savePng(jobId: string, imageBuffer: Buffer): { outputPath: string; imageUrl: string } {
    const filename = `${jobId}.png`;
    const absolutePath = path.join(this.imageDir, filename);
    fs.writeFileSync(absolutePath, imageBuffer);

    return {
      outputPath: absolutePath,
      imageUrl: `${this.publicBaseUrl}/assets/og/${filename}`,
    };
  }
}
