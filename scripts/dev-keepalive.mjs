import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "43217";
const host = process.env.HOST || "0.0.0.0";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

let child = null;
let stopping = false;
let restarts = 0;

function start() {
  if (stopping) return;
  child = spawn(process.execPath, [nextBin, "dev", "--hostname", host, "--port", String(port)], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port), HOST: host, WATCHPACK_POLLING: "true" },
  });
  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) {
      process.exit(code ?? 0);
      return;
    }
    restarts += 1;
    const delay = Math.min(8000, 400 * restarts);
    console.error(
      `[dev-keepalive] next вышел (code=${code ?? "-"} signal=${signal ?? "-"}), перезапуск через ${delay}мс`,
    );
    setTimeout(start, delay);
  });
}

function stop(signal) {
  stopping = true;
  if (child?.pid) {
    try {
      child.kill(signal);
    } catch {
      /* процесс уже мёртв */
    }
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

start();
