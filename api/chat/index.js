/**
 * Vercel Serverless Function — DeepSeek Chat 代理
 * POST /api/chat
 * Body: { messages, apiKey?, model?, max_tokens?, temperature? }
 */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "chat-proxy" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { messages, apiKey: clientKey, model, max_tokens, temperature } = req.body ?? {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "请求 body 需包含非空的 messages 数组" });
    }

    const apiKey = clientKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "未配置 API Key：请在 Vercel 设置 DEEPSEEK_API_KEY，或在前端 API 设置中填入个人密钥",
      });
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
      return res.status(500).json({
        error: data?.error?.message || `DeepSeek API 请求失败 (${response.status})`,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: err.message || "服务器内部错误",
    });
  }
};
