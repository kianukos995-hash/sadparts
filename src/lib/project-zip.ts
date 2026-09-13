import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

export const PROJECT_ZIP_NAME = "sadparts-prices.zip";

export function projectZipPath() {
  return path.join(process.cwd(), "dist", PROJECT_ZIP_NAME);
}

export function ensureProjectZip() {
  const zipPath = projectZipPath();
  if (!existsSync(zipPath)) {
    const packed = spawnSync(process.execPath, ["scripts/pack-release.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    if (packed.status !== 0 || !existsSync(zipPath)) {
      throw new Error(packed.stderr || packed.stdout || "Не удалось собрать ZIP");
    }
  }

  const publicDir = path.join(process.cwd(), "public");
  mkdirSync(publicDir, { recursive: true });
  const publicZip = path.join(publicDir, PROJECT_ZIP_NAME);
  copyFileSync(zipPath, publicZip);

  const bytes = statSync(zipPath).size;
  return { zipPath, bytes, mb: (bytes / (1024 * 1024)).toFixed(1) };
}
