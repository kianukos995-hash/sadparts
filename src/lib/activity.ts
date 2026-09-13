import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ActivityEvent } from "@/lib/types";

const FILE = path.join(process.cwd(), "data", "activity.jsonl");

export async function logActivity(event: Omit<ActivityEvent, "id" | "at"> & { at?: string }) {
  const row: ActivityEvent = {
    id: crypto.randomUUID(),
    at: event.at ?? new Date().toISOString(),
    ...event,
  };
  await mkdir(path.dirname(FILE), { recursive: true });
  await appendFile(FILE, `${JSON.stringify(row)}\n`, "utf8");
  return row;
}

export async function readActivity(limit = 400) {
  try {
    const raw = await readFile(FILE, "utf8");
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const events: ActivityEvent[] = [];
    for (const line of lines.slice(-Math.max(limit, 50))) {
      try {
        events.push(JSON.parse(line) as ActivityEvent);
      } catch {
        // skip bad line
      }
    }
    return events.reverse();
  } catch {
    return [];
  }
}
