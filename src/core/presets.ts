import { Platform } from "./types.js";

export const PRESETS: Record<Platform, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  twitter: { width: 1200, height: 675 },
  linkedin: { width: 1200, height: 627 },
};
