/**
 * 本地开发服务器（无需 npm install）
 * 用法：
 *   set DEEPSEEK_API_KEY=sk-你的密钥
 *   node dev-server.cjs
 * 然后访问 http://localhost:3000
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function handleChatProxy(body) {
  const { messages, apiKey: clientKey, model, max_tokens, temperature } = body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return { status: 400, data: { error: "请求 body 需包含非空的 messages 数组" } };
  }

  const apiKey = clientKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      data: {
        error: "未配置 API Key：请设置环境变量 DEEPSEEK_API_KEY，或在前端 API 设置中填入个人密钥",
      },
    };
  }

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      messages,
      max_tokens: max_tokens ?? 1500,
      temperature: temperature ?? 0.85,
      stream: false,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      status: 500,
      data: { error: data?.error?.message || `DeepSeek API 请求失败 (${response.status})` },
    };
  }

  return { status: 200, data };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404).end("Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(req.url.split("?")[0].replace(/\/+$/, "") || "/");

  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (pathname === "/api/chat" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, service: "chat-proxy", mode: "local-dev" });
  }

  if (pathname === "/api/chat" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const result = await handleChatProxy(body);
      return sendJson(res, result.status, result.data);
    } catch (err) {
      return sendJson(res, 500, { error: err.message || "服务器内部错误" });
    }
  }

  if (pathname.startsWith("/api/")) {
    return sendJson(res, 404, { error: `未找到接口: ${pathname}` });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, {
      error: "当前静态服务器不支持此请求。请用 node dev-server.cjs 启动，并访问 http://localhost:3000",
    });
  }

  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`虚妄编年史本地服务已启动: http://localhost:${PORT}`);
  console.log("API 代理: POST /api/chat");
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log("提示: 未检测到 DEEPSEEK_API_KEY，可在前端 API 设置中填入个人密钥");
  }
});
