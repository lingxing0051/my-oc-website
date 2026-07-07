/**
 * DeepSeek API 封装
 * API Key 存储在 localStorage，键名：xuwang_api_key / xuwang_api_model
 */

// ★ 全局对话模式变量（短/长对话），由 UI 按钮修改
var chatMode = 'short';   // 使用 var 确保挂载到 window，方便跨文件访问

const DeepSeekAPI = {
  STORAGE_KEY: "xuwang_api_key",
  MODEL_KEY: "xuwang_api_model",
  CHAT_PREFIX: "xuwang_chat_",
  SCENARIO_CHAT_PREFIX: "xuwang_scenario_chat_",
  SCENARIO_SUMMARY_PREFIX: "xuwang_scenario_summary_",
  ENDPOINT: "/api/chat",

  getApiKey() {
    return localStorage.getItem(this.STORAGE_KEY) || "";
  },

  setApiKey(key) {
    localStorage.setItem(this.STORAGE_KEY, key);
  },

  getModel() {
    return localStorage.getItem(this.MODEL_KEY) || "deepseek-chat";
  },

  setModel(model) {
    localStorage.setItem(this.MODEL_KEY, model);
  },

  /* ── 对话历史 ── */
  getChatHistory(characterId) {
    try {
      const raw = localStorage.getItem(this.CHAT_PREFIX + characterId);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveChatHistory(characterId, messages) {
    localStorage.setItem(this.CHAT_PREFIX + characterId, JSON.stringify(messages));
  },

  clearChatHistory(characterId) {
    localStorage.removeItem(this.CHAT_PREFIX + characterId);
  },

  /* ── 情景对话历史 ── */
  getScenarioHistory(characterId, eventId) {
    try {
      const raw = localStorage.getItem(this.SCENARIO_CHAT_PREFIX + characterId + "_" + eventId);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveScenarioHistory(characterId, eventId, messages) {
    localStorage.setItem(
      this.SCENARIO_CHAT_PREFIX + characterId + "_" + eventId,
      JSON.stringify(messages)
    );
  },

  clearScenarioHistory(characterId, eventId) {
    localStorage.removeItem(this.SCENARIO_CHAT_PREFIX + characterId + "_" + eventId);
  },

  getScenarioSummary(characterId, eventId) {
    return localStorage.getItem(this.SCENARIO_SUMMARY_PREFIX + characterId + "_" + eventId) || "";
  },

  saveScenarioSummary(characterId, eventId, summary) {
    localStorage.setItem(this.SCENARIO_SUMMARY_PREFIX + characterId + "_" + eventId, summary);
  },

  /** 根据对话模式拼接系统提示后缀 */
  appendChatModeSuffix(systemPrompt) {
    const mode = typeof window.chatMode !== "undefined" ? window.chatMode : "short";
    if (mode === "long") {
      return systemPrompt + "请详细、生动地描述，包含内心活动和场景细节。";
    }
    return systemPrompt + "请简洁回答。";
  },

  /** 根据对话模式返回 max_tokens */
  getChatModeMaxTokens() {
    const mode = typeof window.chatMode !== "undefined" ? window.chatMode : "short";
    return mode === "long" ? 600 : 200;
  },

  /**
   * 通用 DeepSeek 调用
   * @param {Array<{role: string, content: string}>} messages - 含 system / user / assistant 的完整消息列表
   * @param {{ maxTokens?: number, temperature?: number }} options
   */
  async callDeepSeek(messages, options = {}) {
    const response = await fetch(this.ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = typeof err.error === "string" ? err.error : err.error?.message;
      throw new Error(message || `API 请求失败 (${response.status})`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  },

  /* ── 单人对话：发送消息 ── */
  async sendMessage(systemPrompt, history, userMessage) {
    systemPrompt = this.appendChatModeSuffix(systemPrompt);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage }
    ];

    const maxTokens = this.getChatModeMaxTokens();
    const temperature = window.chatMode === "long" ? 0.9 : 0.85;

    return this.callDeepSeek(messages, { maxTokens, temperature });
  },

  /** 情景对话：发送消息（使用事件专属 systemPrompt） */
  async sendScenarioMessage(systemPrompt, history, userMessage) {
    return this.sendMessage(systemPrompt, history, userMessage);
  },

  /** 根据情景对话生成第三人称故事总结 */
  async generateScenarioSummary(event, history, characterName) {
    const transcript = history.map(m => {
      const label = m.role === "user" ? "访客" : characterName;
      return `${label}：${m.content}`;
    }).join("\n");

    const messages = [
      {
        role: "system",
        content: "你是虚妄编年史的记录者。请根据情景对话内容，以第三人称撰写一段故事总结（150~300字），文风沉浸、客观叙述，不要使用第一人称，不要加标题。"
      },
      {
        role: "user",
        content: `【情景信息】
时间：${event.date}
地点：${event.location}
事件：${event.title}
氛围：${event.mood}
描述：${event.description}

【对话记录】
${transcript || "（对话较短，请根据情景信息合理续写）"}

请撰写第三人称故事总结：`
      }
    ];

    return this.callDeepSeek(messages, { maxTokens: 400, temperature: 0.75 });
  }
};

/**
 * 角色自定义头像存储（localStorage，Base64 图片）
 */
const AvatarStore = {
  PREFIX: "xuwang_avatar_",
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  getAvatarUrl(characterId) {
    return localStorage.getItem(this.PREFIX + characterId) || "";
  },

  setAvatarUrl(characterId, dataUrl) {
    localStorage.setItem(this.PREFIX + characterId, dataUrl);
  },

  clearAvatar(characterId) {
    localStorage.removeItem(this.PREFIX + characterId);
  },

  hasCustomAvatar(characterId) {
    return !!this.getAvatarUrl(characterId);
  }
};
