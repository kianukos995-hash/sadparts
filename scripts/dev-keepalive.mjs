import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextPort = process.env.NEXT_PORT || "43218";
const proxyPorts = process.env.PROXY_PORTS || "888";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const proxyBin = path.join(root, "scripts", "preview-proxy.mjs");

let nextChild = null;
let proxyChild = null;
let stopping = false;
let restarts = 0;

function spawnNext() {
  if (stopping) return;
  nextChild = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(nextPort)],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, PORT: String(nextPort), HOST: "127.0.0.1", WATCHPACK_POLLING: "true" },
    },
  );
  nextChild.on("exit", (code, signal) => {
    nextChild = null;
    if (stopping) return finish();
    restarts += 1;
    const delay = Math.min(8000, 400 * restarts);
    console.error(
      `[dev-keepalive] next вышел (code=${code ?? "-"} signal=${signal ?? "-"}), перезапуск через ${delay}мс`,
    );
    setTimeout(spawnNext, delay);
  });
}

function spawnProxy() {
  if (stopping) return;
  proxyChild = spawn(process.execPath, [proxyBin], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      UPSTREAM_HOST: "127.0.0.1",
      UPSTREAM_PORT: String(nextPort),
      PROXY_PORTS: proxyPorts,
    },
  });
  proxyChild.on("exit", (code, signal) => {
    proxyChild = null;
    if (stopping) return finish();
    console.error(`[dev-keepalive] proxy вышел (code=${code ?? "-"} signal=${signal ?? "-"}), перезапуск`);
    setTimeout(spawnProxy, 400);
  });
}

function finish() {
  if (nextChild || proxyChild) return;
  process.exit(0);
}

function stop(signal) {
  stopping = true;
  for (const child of [nextChild, proxyChild]) {
    if (!child?.pid) continue;
    try {
      child.kill(signal);
    } catch {
      /* уже мёртв */
    }
  }
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

spawnNext();
spawnProxy();
