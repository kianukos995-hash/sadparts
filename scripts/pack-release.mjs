import { spawnSync } from "node:child_process";
import { mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const zipName = "sadparts-prices.zip";
const zipPath = path.join(dist, zipName);

mkdirSync(dist, { recursive: true });
if (existsSync(zipPath)) {
  spawnSync("rm", ["-f", zipPath], { cwd: root });
}

const exclude = [
  "node_modules/*",
  ".next/*",
  ".git/*",
  "dist/*",
  ".sadparts-chrome/*",
  "coverage/*",
  "*.pem",
  ".env",
  ".env.*",
];

const args = ["-r", "-q", zipPath, ".", "-x", ...exclude];
const zip = spawnSync("zip", args, { cwd: root, encoding: "utf8" });
if (zip.status !== 0) {
  console.error(zip.stderr || zip.stdout || "zip failed");
  process.exit(zip.status ?? 1);
}

const bytes = statSync(zipPath).size;
const mb = (bytes / (1024 * 1024)).toFixed(1);
const artifactDir = "/opt/cursor/artifacts";
if (existsSync(artifactDir)) {
  copyFileSync(zipPath, path.join(artifactDir, zipName));
}
console.log(`packed ${zipPath} (${mb} MB)`);
