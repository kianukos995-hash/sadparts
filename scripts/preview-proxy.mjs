import http from "node:http";
import net from "node:net";

const UPSTREAM_HOST = process.env.UPSTREAM_HOST || "127.0.0.1";
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT || 43218);
const PORTS = (process.env.PROXY_PORTS || "888")
  .split(",")
  .map((item) => Number(item.trim()))
  .filter(Boolean);

function hopByHop(name) {
  return [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
  ].includes(name.toLowerCase());
}

function outgoingHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || hopByHop(key)) continue;
    out[key] = value;
  }
  out.connection = "close";
  return out;
}

function proxyRequest(req, res) {
  if (req.url === "/_preview-ok") {
    const body = Buffer.from("ok", "utf8");
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "content-length": String(body.length),
      connection: "close",
    });
    res.end(body);
    return;
  }

  const method = req.method || "GET";
  const bufferBody = method === "GET" || method === "HEAD";
  const headers = { ...req.headers, host: `${UPSTREAM_HOST}:${UPSTREAM_PORT}`, connection: "close" };
  const upstream = http.request(
    {
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      path: req.url,
      method,
      headers,
    },
    (incoming) => {
      if (!bufferBody) {
        res.writeHead(incoming.statusCode || 502, outgoingHeaders(incoming.headers));
        incoming.pipe(res);
        return;
      }
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => {
        const body = Buffer.concat(chunks);
        const out = outgoingHeaders(incoming.headers);
        out["content-length"] = String(body.length);
        res.writeHead(incoming.statusCode || 502, out);
        res.end(body);
      });
    },
  );
  upstream.on("error", (error) => {
    if (!res.headersSent) {
      res.writeHead(502, {
        "content-type": "text/plain; charset=utf-8",
        connection: "close",
      });
    }
    res.end(`SadParts proxy: ${error.message}`);
  });
  req.pipe(upstream);
}

function proxyUpgrade(req, socket, head) {
  const upstream = net.connect(UPSTREAM_PORT, UPSTREAM_HOST, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`, `Host: ${UPSTREAM_HOST}:${UPSTREAM_PORT}`];
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === "host" || value === undefined) continue;
      lines.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    }
    lines.push("", "");
    upstream.write(lines.join("\r\n"));
    if (head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

function listen(port, host) {
  const server = http.createServer(proxyRequest);
  server.httpAllowHalfOpen = false;
  server.keepAliveTimeout = 0;
  server.headersTimeout = 60_000;
  server.on("upgrade", proxyUpgrade);
  server.on("connection", (socket) => {
    socket.setKeepAlive(false);
    socket.setTimeout(120_000);
  });
  server.listen(port, host, () => {
    console.log(`[preview-proxy] http://${host === "::" ? "[::]" : host}:${port} → ${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
  });
  server.on("error", (error) => {
    console.error(`[preview-proxy] ${host}:${port} ${error.message}`);
    process.exit(1);
  });
  return server;
}

const servers = [];
for (const port of PORTS) {
  servers.push(listen(port, "0.0.0.0"));
}

function shutdown() {
  for (const server of servers) server.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
