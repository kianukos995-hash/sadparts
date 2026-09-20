import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "888";
const host = process.env.HOST || "0.0.0.0";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "start", "--hostname", host, "--port", String(port)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: String(port), HOST: host },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
