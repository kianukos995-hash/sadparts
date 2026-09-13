#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = Number.parseInt(process.env.PORT || "43217", 10);
const URL = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");

function waitForPort(timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = createConnection({ host: "127.0.0.1", port: PORT }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Сервер не поднялся на ${URL}`));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function isUp() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: PORT }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

function chromeCandidates() {
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "google-chrome",
    ];
  }
  if (process.platform === "win32") {
    return [
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      "chrome",
    ];
  }
  return ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"];
}

function openApp() {
  const listed = chromeCandidates().filter((item) => item && (item.includes("/") ? existsSync(item) : true));
  const args = [`--app=${URL}`, `--user-data-dir=${path.join(ROOT, ".sadparts-chrome")}`, "--new-window"];
  for (const bin of listed) {
    try {
      const child = spawn(bin, args, { detached: true, stdio: "ignore" });
      child.unref();
      return;
    } catch {
      // try next
    }
  }
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", URL], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn(process.platform === "darwin" ? "open" : "xdg-open", [URL], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

const already = await isUp();
if (!already) {
  const cmd = existsSync(path.join(ROOT, ".next")) ? "start" : "dev";
  spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", cmd], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  await waitForPort();
}

openApp();
console.log(`SadParts Prices — окно приложения: ${URL}`);
