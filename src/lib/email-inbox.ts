import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EmailInboxItem } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const INBOX_FILE = path.join(DATA_DIR, "email-inbox.json");

export async function readEmailInbox(): Promise<EmailInboxItem[]> {
  try {
    const raw = await readFile(INBOX_FILE, "utf8");
    const parsed = JSON.parse(raw) as EmailInboxItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendEmailInbox(item: EmailInboxItem) {
  const items = await readEmailInbox();
  const next = [item, ...items].slice(0, 80);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INBOX_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
