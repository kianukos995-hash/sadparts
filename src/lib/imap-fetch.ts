import tls from "node:tls";
import net from "node:net";
import { priceMailboxConfig } from "@/lib/price-mailbox";

export type ImapMessage = {
  uid: string;
  raw: Buffer;
};

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

class ImapSession {
  private buf = Buffer.alloc(0);
  private tag = 0;
  constructor(private socket: net.Socket) {}

  async greet() {
    await this.readLine();
  }

  async command(payload: string) {
    this.tag += 1;
    const id = `A${this.tag}`;
    this.socket.write(`${id} ${payload}\r\n`);
    return this.readUntilTag(id);
  }

  async fetchRfc822(seq: string) {
    this.tag += 1;
    const id = `A${this.tag}`;
    this.socket.write(`${id} FETCH ${seq} (RFC822)\r\n`);
    const chunks: Buffer[] = [];
    let inLiteral = 0;
    let done = false;
    while (!done) {
      const { line, rest } = await this.readLineOrLiteral();
      if (inLiteral > 0) {
        chunks.push(line);
        inLiteral = 0;
        if (rest) this.buf = Buffer.concat([rest, this.buf]);
        continue;
      }
      const text = line.toString("utf8");
      const lit = text.match(/RFC822\s+\{(\d+)\}/i);
      if (lit) {
        inLiteral = Number.parseInt(lit[1], 10);
        const body = await this.readBytes(inLiteral);
        chunks.push(body);
        continue;
      }
      if (text.startsWith(`${id} `)) {
        if (!/ok/i.test(text)) throw new Error(`IMAP FETCH: ${text}`);
        done = true;
      }
    }
    if (chunks.length === 0) throw new Error("IMAP: пустой RFC822");
    return chunks[chunks.length - 1];
  }

  end() {
    this.socket.end();
  }

  private readBytes(n: number) {
    return new Promise<Buffer>((resolve, reject) => {
      const tryRead = () => {
        if (this.buf.length >= n) {
          const out = this.buf.subarray(0, n);
          this.buf = this.buf.subarray(n);
          resolve(out);
          return true;
        }
        return false;
      };
      if (tryRead()) return;
      const onData = (chunk: Buffer) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        if (tryRead()) this.socket.off("data", onData);
      };
      this.socket.on("data", onData);
      this.socket.once("error", reject);
    });
  }

  private readLineOrLiteral() {
    return this.readLine().then((line) => ({ line, rest: null as Buffer | null }));
  }

  private readLine() {
    return new Promise<Buffer>((resolve, reject) => {
      const tryRead = () => {
        const idx = this.buf.indexOf("\n");
        if (idx >= 0) {
          let line = this.buf.subarray(0, idx);
          this.buf = this.buf.subarray(idx + 1);
          if (line.length && line[line.length - 1] === 13) line = line.subarray(0, line.length - 1);
          resolve(line);
          return true;
        }
        return false;
      };
      if (tryRead()) return;
      const onData = (chunk: Buffer) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        if (tryRead()) this.socket.off("data", onData);
      };
      this.socket.on("data", onData);
      this.socket.once("error", reject);
    });
  }

  private async readUntilTag(id: string) {
    const lines: string[] = [];
    while (true) {
      const line = (await this.readLine()).toString("utf8");
      lines.push(line);
      if (line.startsWith(`${id} `)) {
        if (!/ok/i.test(line)) throw new Error(`IMAP ${id}: ${line}`);
        return lines;
      }
    }
  }
}

export async function fetchUnseenMail(): Promise<ImapMessage[]> {
  const cfg = priceMailboxConfig();
  if (!cfg.imapHost || !cfg.imapUser || !cfg.imapPass) {
    throw new Error("IMAP не задан: PRICE_IMAP_HOST / USER / PASS в .env");
  }
  const socket = await new Promise<net.Socket>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    const sock = cfg.imapTls
      ? tls.connect({ host: cfg.imapHost, port: cfg.imapPort, servername: cfg.imapHost }, () => {
          sock.off("error", onError);
          resolve(sock);
        })
      : net.connect({ host: cfg.imapHost, port: cfg.imapPort }, () => {
          sock.off("error", onError);
          resolve(sock);
        });
    sock.once("error", onError);
  });
  socket.setTimeout(25_000, () => socket.destroy(new Error("IMAP timeout")));
  const session = new ImapSession(socket);
  try {
    await session.greet();
    await session.command(`LOGIN ${quote(cfg.imapUser)} ${quote(cfg.imapPass)}`);
    await session.command("SELECT INBOX");
    const search = await session.command("SEARCH UNSEEN");
    const ids = (search.find((line) => line.startsWith("* SEARCH")) ?? "")
      .replace(/^\* SEARCH\s*/i, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const messages: ImapMessage[] = [];
    for (const id of ids) {
      const raw = await session.fetchRfc822(id);
      messages.push({ uid: id, raw });
      await session.command(`STORE ${id} +FLAGS (\\Seen)`);
    }
    await session.command("LOGOUT").catch(() => undefined);
    return messages;
  } finally {
    session.end();
  }
}
