window.chatMode = 'short'; // 默认短对话
/**
 * 虚妄编年史 · 主应用逻辑
 */
(function () {
  "use strict";

  /* ── DOM 引用 ── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sidebar = $("#sidebar");
  const sidebarOverlay = $("#sidebarOverlay");
  const menuToggle = $("#menuToggle");
  const charDetail = $("#charDetail");
  const chatPanel = $("#chatPanel");

  let currentCharacter = null;
  let isSending = false;
  let isGroupSending = false;

  /** 情景对话状态 */
  let scenarioState = {
    active: false,
    eventId: null,
    event: null
  };

  /** 群聊状态 */
  let groupChatState = {
    active: false,
    selectedCharacters: [],
    time: "",
    location: "",
    background: "",
    userRole: null,
    history: [],
    systemPrompt: ""
  };

  /* ── 初始化 ── */
  function init() {
    renderTimeline();
    renderWorldMap();
    renderGeography();
    renderFactions();
    renderCharacters();
    bindNavigation();
    bindMobileMenu();
    bindSettings();
    bindCharacterDetail();
    bindChat();
    bindGroupChat();
  }

  /* ── 导航切换 ── */
  function bindNavigation() {
    $$(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const section = btn.dataset.section;
        $$(".nav-item").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        $$(".content-section").forEach(s => s.classList.remove("active"));
        $(`#section-${section}`).classList.add("active");
        closeSidebar();
        if (section !== "characters") closeCharacterDetail();
      });
    });
  }

  /* ── 移动端菜单 ── */
  function bindMobileMenu() {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      sidebarOverlay.classList.toggle("active");
    });
    sidebarOverlay.addEventListener("click", closeSidebar);
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
  }

  /* ── 渲染：时间轴 ── */
  function renderTimeline() {
    const container = $("#timelineContainer");
    container.innerHTML = WORLD_DATA.timeline.map(era => `
      <div class="timeline-era" data-era="${era.id}">
        <div class="timeline-era-header">
          <div class="era-label">
            <span class="era-badge">${era.era}</span>
            <span class="era-title">${era.title}</span>
          </div>
          <span class="era-toggle">▼</span>
        </div>
        <div class="timeline-era-body">
          <div class="timeline-events">
            ${era.events.map(ev => `
              <div class="timeline-event">
                <div class="event-year">${ev.year}</div>
                <div class="event-title">${ev.title}</div>
                <div class="event-desc">${ev.description}</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".timeline-era-header").forEach(header => {
      header.addEventListener("click", () => {
        header.parentElement.classList.toggle("open");
      });
    });
  }

  /* ── 渲染：世界地图 ── */
  function renderWorldMap() {
    const map = WORLD_DATA.worldMap;
    const container = $("#worldMapContainer");
    if (!map || !container) return;

    const factionColors = Object.fromEntries(map.legend.map(l => [l.key, l.color]));

    container.innerHTML = `
      <div class="world-map-header">
        <h3 class="world-map-title">${map.title}</h3>
        <p class="world-map-subtitle">${map.subtitle}</p>
      </div>
      <div class="world-map-layout">
        <div class="world-map-canvas">
          <svg class="world-map-svg" viewBox="${map.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${map.title}">
            <defs>
              <filter id="mapGlow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="#0a0c12" rx="8"/>
            <path class="map-ocean" d="M0,0 L900,0 L900,640 L0,640 Z" fill="#0d1520"/>
            <path class="map-coastline" d="M60,60 L840,40 L860,600 L40,620 L20,200 Z" fill="#141820" stroke="#2a3144" stroke-width="2"/>
            ${map.regions.map(r => `
              <path class="map-region" data-id="${r.id}" d="${r.path}"
                fill="${factionColors[r.faction] || '#555'}" fill-opacity="0.35"
                stroke="${factionColors[r.faction] || '#555'}" stroke-width="2"
                stroke-linejoin="round"/>
              <text class="map-label" x="${centroid(r.path).x}" y="${centroid(r.path).y}"
                text-anchor="middle" dominant-baseline="middle">${r.name}</text>
            `).join("")}
            ${(map.markers || []).map(m => `
              <text class="map-marker" x="${m.x}" y="${m.y}" text-anchor="middle">${m.icon}</text>
            `).join("")}
          </svg>
          <div class="map-legend">
            ${map.legend.map(l => `
              <span class="map-legend-item">
                <i style="background:${l.color}"></i>${l.label}
              </span>
            `).join("")}
          </div>
        </div>
        <div class="map-info-panel" id="mapInfoPanel">
          <div class="map-info-placeholder">
            <span class="map-info-icon">🗺️</span>
            <p>点击地图上的区域<br>查看势力与地理详情</p>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll(".map-region").forEach(path => {
      path.addEventListener("click", () => selectMapRegion(path.dataset.id));
      path.addEventListener("mouseenter", () => path.setAttribute("fill-opacity", "0.55"));
      path.addEventListener("mouseleave", () => {
        if (!path.classList.contains("active")) path.setAttribute("fill-opacity", "0.35");
      });
    });

    selectMapRegion(map.regions[0]?.id);
  }

  function centroid(pathD) {
    const nums = pathD.match(/-?\d+\.?\d*/g).map(Number);
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < nums.length - 1; i += 2) {
      sx += nums[i]; sy += nums[i + 1]; n++;
    }
    return { x: Math.round(sx / n), y: Math.round(sy / n) };
  }

  function selectMapRegion(id) {
    const region = WORLD_DATA.worldMap.regions.find(r => r.id === id);
    const panel = $("#mapInfoPanel");
    if (!region || !panel) return;

    $$(".map-region").forEach(p => {
      p.classList.toggle("active", p.dataset.id === id);
      p.setAttribute("fill-opacity", p.dataset.id === id ? "0.6" : "0.35");
    });

    const geo = WORLD_DATA.geography.find(g => g.id === id);
    panel.innerHTML = `
      <div class="map-info-content">
        <h3>${region.name}</h3>
        <div class="map-info-faction">${region.factionLabel}</div>
        <div class="map-info-ruler"><strong>统属：</strong>${region.ruler}</div>
        <p class="map-info-desc">${region.description}</p>
        ${geo ? `
          <div class="map-info-tags">
            ${geo.tags.map(t => `<span class="geo-tag">${t}</span>`).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  /* ── 渲染：地理志 ── */
  function renderGeography() {
    const container = $("#geographyContainer");
    container.innerHTML = WORLD_DATA.geography.map(geo => `
      <div class="geo-card">
        <div class="geo-card-header">
          <div class="geo-icon">${geo.icon}</div>
          <div>
            <div class="geo-name">${geo.name}</div>
            <div class="geo-type">${geo.type}</div>
          </div>
        </div>
        <p class="geo-desc">${geo.description}</p>
        <div class="geo-tags">
          ${geo.tags.map(t => `<span class="geo-tag">${t}</span>`).join("")}
        </div>
      </div>
    `).join("");
  }

  /* ── 渲染：势力 ── */
  function renderFactions() {
    const tabsEl = $("#factionTabs");
    const contentEl = $("#factionContainer");
    const keys = Object.keys(WORLD_DATA.factions);

    tabsEl.innerHTML = keys.map(key => {
      const f = WORLD_DATA.factions[key];
      return `<button class="faction-tab" data-faction="${key}">${f.label}</button>`;
    }).join("");

    contentEl.innerHTML = keys.map(key => {
      const f = WORLD_DATA.factions[key];
      return `
        <div class="faction-group" data-faction="${key}">
          ${f.groups.map(g => `
            <div class="faction-card">
              <h3>${g.name}</h3>
              <div class="faction-leader">领袖：${g.leader}</div>
              <p>${g.description}</p>
              <p><strong>特征：</strong>${g.traits.join(" · ")}</p>
              <ul>${g.members.map(m => `<li>${m}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      `;
    }).join("");

    function activateTab(key) {
      $$(".faction-tab").forEach(t => {
        t.className = "faction-tab";
        if (t.dataset.faction === key) {
          t.classList.add(`active-${WORLD_DATA.factions[key].color}`);
        }
      });
      $$(".faction-group").forEach(g => g.classList.remove("active"));
      $(`.faction-group[data-faction="${key}"]`).classList.add("active");
    }

    tabsEl.querySelectorAll(".faction-tab").forEach(tab => {
      tab.addEventListener("click", () => activateTab(tab.dataset.faction));
    });

    activateTab(keys[0]);
  }

  /* ── 渲染：人物卡片 ── */
  function getCharacterAvatarUrl(ch) {
    const custom = AvatarStore.getAvatarUrl(ch.id);
    if (custom) return custom;
    return ch.avatarUrl || "";
  }

  function renderAvatarInner(ch, altName) {
    const url = getCharacterAvatarUrl(ch);
    if (url) {
      return `<img src="${url}" alt="${escapeAttr(altName || ch.name)}">`;
    }
    return ch.avatar;
  }

  function renderCharacters() {
    const grid = $("#characterGrid");
    grid.innerHTML = WORLD_DATA.characters.map(ch => `
      <div class="char-card" data-id="${ch.id}">
        <div class="char-avatar">${renderAvatarInner(ch)}</div>
        <div class="char-name">${ch.name}</div>
        <div class="char-identity">${ch.identity}</div>
        <div class="char-stats">
          <span class="char-stat">${ch.spiritualRoot}灵根</span>
          <span class="char-stat">${ch.cultivation}</span>
        </div>
      </div>
    `).join("");

    grid.querySelectorAll(".char-card").forEach(card => {
      card.addEventListener("click", () => openCharacterDetail(card.dataset.id));
    });
  }

  /* ── 人物详情 ── */
  function openCharacterDetail(id) {
    const ch = WORLD_DATA.characters.find(c => c.id === id);
    if (!ch) return;

    currentCharacter = ch;
    chatPanel.hidden = true;
    exitScenarioMode(false);

    $("#detailHeader").innerHTML = `
      <div class="detail-avatar-wrap">
        <div class="detail-avatar" id="detailAvatarPreview">${renderAvatarInner(ch)}</div>
        <div class="avatar-upload-actions">
          <label class="btn btn-ghost btn-sm avatar-upload-btn" title="导入本地图片作为头像">
            导入头像
            <input type="file" id="avatarFileInput" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
          </label>
          <button class="btn btn-ghost btn-sm" id="avatarResetBtn" type="button"${AvatarStore.hasCustomAvatar(ch.id) ? "" : " hidden"}>恢复默认</button>
        </div>
        <p class="avatar-upload-hint">支持 PNG / JPG / GIF / WebP，最大 5MB</p>
      </div>
      <div class="detail-info">
        <h3>${ch.name}</h3>
        <div class="detail-identity">${ch.identity}${ch.age ? ` · ${ch.age}岁` : ""}${ch.species ? ` · ${ch.species}` : ""}</div>
        <div class="detail-tags">
          <span class="detail-tag">${ch.spiritualRoot}灵根</span>
          <span class="detail-tag">${ch.cultivation}</span>
        </div>
      </div>
    `;

    $("#detailBody").innerHTML = `
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="profile" type="button">档案</button>
        <button class="detail-tab" data-tab="timeline" type="button">时间线${ch.timeline?.length ? ` (${ch.timeline.length})` : ""}</button>
      </div>
      <div class="detail-tab-panel active" id="detailTabProfile">
        <div class="detail-section">
          <h4>完整信息</h4>
          <p>${ch.fullInfo}</p>
        </div>
        <div class="detail-section">
          <h4>生平故事</h4>
          <p>${ch.biography.replace(/\n/g, "<br>")}</p>
        </div>
        <div class="detail-section">
          <h4>关系网</h4>
          <div class="relation-list">
            ${ch.relationships.map(r => `
              <div class="relation-item">
                <span class="relation-name">${r.name}</span>
                <span class="relation-desc">${r.relation} — ${r.description}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="detail-tab-panel" id="detailTabTimeline">
        ${renderCharacterTimeline(ch)}
      </div>
    `;

    bindDetailTabs();
    bindTimelineEvents(ch);
    bindAvatarUpload(ch);

    charDetail.hidden = false;
    charDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function closeCharacterDetail() {
    charDetail.hidden = true;
    chatPanel.hidden = true;
    exitScenarioMode(false);
    currentCharacter = null;
  }

  function bindDetailTabs() {
    $$(".detail-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        $$(".detail-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === target));
        $("#detailTabProfile").classList.toggle("active", target === "profile");
        $("#detailTabTimeline").classList.toggle("active", target === "timeline");
      });
    });
  }

  function getEventSummary(ch, event) {
    const stored = DeepSeekAPI.getScenarioSummary(ch.id, event.id);
    if (stored) return stored;
    return event.summary || "";
  }

  function renderCharacterTimeline(ch) {
    const events = ch.timeline || [];
    if (events.length === 0) {
      return `<div class="char-timeline-empty">该角色暂无个人时间线事件。</div>`;
    }

    return `
      <div class="char-timeline">
        ${events.map((ev, idx) => {
          const summary = getEventSummary(ch, ev);
          return `
            <div class="char-timeline-item${summary ? " has-summary" : ""}" data-event-id="${ev.id}">
              <div class="char-timeline-node">
                <span class="char-timeline-dot"></span>
                ${idx < events.length - 1 ? '<span class="char-timeline-line"></span>' : ""}
              </div>
              <div class="char-timeline-content">
                <div class="char-timeline-date">${ev.date}</div>
                <div class="char-timeline-title">${ev.title}</div>
                <div class="char-timeline-desc">${ev.description}</div>
                <div class="char-timeline-meta">
                  <span>📍 ${ev.location}</span>
                  <span>🎭 ${ev.mood}</span>
                </div>
                ${summary ? `
                  <div class="char-timeline-summary">
                    <strong>故事总结</strong>
                    <p>${escapeHtml(summary)}</p>
                  </div>
                ` : ""}
                <button class="btn btn-primary btn-sm char-timeline-enter" data-event-id="${ev.id}" type="button">
                  进入情景对话
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function bindTimelineEvents(ch) {
    $$(".char-timeline-enter").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        enterScenarioMode(ch.id, btn.dataset.eventId);
      });
    });
  }

  function refreshCharacterTimeline() {
    if (!currentCharacter) return;
    const panel = $("#detailTabTimeline");
    if (panel) {
      panel.innerHTML = renderCharacterTimeline(currentCharacter);
      bindTimelineEvents(currentCharacter);
    }
  }

  function enterScenarioMode(characterId, eventId) {
    const ch = WORLD_DATA.characters.find(c => c.id === characterId);
    const event = ch?.timeline?.find(e => e.id === eventId);
    if (!ch || !event) return;

    currentCharacter = ch;
    scenarioState = { active: true, eventId, event };

    chatPanel.hidden = false;
    updateChatHeader();
    updateScenarioContext();
    renderChatMessages();
    $("#chatInput").focus();
    charDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function exitScenarioMode(rerender = true) {
    scenarioState = { active: false, eventId: null, event: null };
    $("#scenarioContext").hidden = true;
    $("#exitScenarioBtn").hidden = true;
    if (rerender && currentCharacter) {
      updateChatHeader();
      renderChatMessages();
    }
  }

  function updateChatHeader() {
    if (!currentCharacter) return;
    $("#chatCharName").textContent = currentCharacter.name;
    const label = $("#chatHeaderLabel");
    if (scenarioState.active && scenarioState.event) {
      label.innerHTML = `情景 · <strong>${escapeHtml(scenarioState.event.title)}</strong>`;
      $("#exitScenarioBtn").hidden = false;
    } else {
      label.innerHTML = `与 <strong id="chatCharName">${currentCharacter.name}</strong> 对话`;
      $("#exitScenarioBtn").hidden = true;
    }
  }

  function updateScenarioContext() {
    const ctx = $("#scenarioContext");
    if (!scenarioState.active || !scenarioState.event) {
      ctx.hidden = true;
      return;
    }
    const ev = scenarioState.event;
    $("#scenarioTitle").textContent = ev.title;
    $("#scenarioLocation").textContent = ev.location;
    $("#scenarioMood").textContent = ev.mood;
    ctx.hidden = false;
  }

  function getActiveChatHistory() {
    if (!currentCharacter) return [];
    if (scenarioState.active && scenarioState.eventId) {
      return DeepSeekAPI.getScenarioHistory(currentCharacter.id, scenarioState.eventId);
    }
    return DeepSeekAPI.getChatHistory(currentCharacter.id);
  }

  function saveActiveChatHistory(history) {
    if (!currentCharacter) return;
    if (scenarioState.active && scenarioState.eventId) {
      DeepSeekAPI.saveScenarioHistory(currentCharacter.id, scenarioState.eventId, history);
    } else {
      DeepSeekAPI.saveChatHistory(currentCharacter.id, history);
    }
  }

  function getActiveSystemPrompt() {
    if (scenarioState.active && scenarioState.event) {
      return `${WORLD_SETTING}\n\n---\n\n${scenarioState.event.systemPrompt}`;
    }
    return currentCharacter.systemPrompt;
  }

  function checkEndingTriggers(text) {
    if (!scenarioState.active || !scenarioState.event) return false;
    const triggers = scenarioState.event.endingTriggers || [];
    return triggers.some(t => t && text.includes(t));
  }

  async function endScenarioEvent() {
    if (!currentCharacter || !scenarioState.active || !scenarioState.event || isSending) return;

    const history = getActiveChatHistory();
    isSending = true;
    $("#sendChatBtn").disabled = true;
    $("#endScenarioBtn").disabled = true;

    const container = $("#chatMessages");
    container.innerHTML += `
      <div class="chat-msg assistant loading" id="loadingMsg">
        <div class="chat-msg-avatar">📜</div>
        <div class="chat-bubble">正在撰写故事总结…</div>
      </div>
    `;
    container.scrollTop = container.scrollHeight;

    try {
      const summary = await DeepSeekAPI.generateScenarioSummary(
        scenarioState.event,
        history,
        currentCharacter.name
      );
      DeepSeekAPI.saveScenarioSummary(currentCharacter.id, scenarioState.event.id, summary);
      scenarioState.event.summary = summary;

      container.innerHTML += `
        <div class="chat-msg assistant scenario-summary-msg">
          <div class="chat-msg-avatar">📜</div>
          <div class="chat-bubble scenario-summary-bubble">
            <strong>【事件总结】</strong><br>${escapeHtml(summary)}
          </div>
        </div>
      `;
      container.scrollTop = container.scrollHeight;
      refreshCharacterTimeline();
    } catch (err) {
      alert(err.message);
    } finally {
      isSending = false;
      $("#sendChatBtn").disabled = false;
      $("#endScenarioBtn").disabled = false;
      $("#loadingMsg")?.remove();
    }
  }

  function bindAvatarUpload(ch) {
    const fileInput = $("#avatarFileInput");
    const resetBtn = $("#avatarResetBtn");
    if (!fileInput) return;

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("请选择图片文件（PNG、JPG、GIF 或 WebP）");
        return;
      }
      if (file.size > AvatarStore.MAX_FILE_SIZE) {
        alert("图片过大，请选择 5MB 以内的文件");
        return;
      }

      try {
        const dataUrl = await compressAvatarImage(file);
        AvatarStore.setAvatarUrl(ch.id, dataUrl);
        refreshCharacterAvatarUI(ch);
      } catch {
        alert("图片读取失败，请换一张试试");
      }
    });

    resetBtn?.addEventListener("click", () => {
      if (!confirm(`确定恢复 ${ch.name} 的默认头像？`)) return;
      AvatarStore.clearAvatar(ch.id);
      refreshCharacterAvatarUI(ch);
    });
  }

  function compressAvatarImage(file, maxSize = 256, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function refreshCharacterAvatarUI(ch) {
    const preview = $("#detailAvatarPreview");
    if (preview) preview.innerHTML = renderAvatarInner(ch);

    const resetBtn = $("#avatarResetBtn");
    if (resetBtn) resetBtn.hidden = !AvatarStore.hasCustomAvatar(ch.id);

    const card = $(`.char-card[data-id="${ch.id}"] .char-avatar`);
    if (card) card.innerHTML = renderAvatarInner(ch);

    if (currentCharacter?.id === ch.id && !chatPanel.hidden) {
      renderChatMessages();
    }

    renderGroupCharOptions();
  }

  function bindCharacterDetail() {
    $("#detailClose").addEventListener("click", closeCharacterDetail);

    $("#aiChatBtn").addEventListener("click", () => {
      if (!currentCharacter) return;
      if (scenarioState.active) exitScenarioMode(false);
      chatPanel.hidden = !chatPanel.hidden;
      if (!chatPanel.hidden) {
        updateChatHeader();
        updateScenarioContext();
        renderChatMessages();
        $("#chatInput").focus();
      }
    });

    $("#exitScenarioBtn").addEventListener("click", () => {
      exitScenarioMode();
      updateScenarioContext();
    });
  }

  /* ── AI 聊天 ── */
  function bindChat() {
    $("#sendChatBtn").addEventListener("click", sendChat);
    $("#chatInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
    $("#clearChatBtn").addEventListener("click", () => {
      if (!currentCharacter) return;
      const label = scenarioState.active
        ? `情景「${scenarioState.event?.title}」`
        : `与 ${currentCharacter.name}`;
      if (confirm(`确定清除${label}的所有对话记录？`)) {
        if (scenarioState.active && scenarioState.eventId) {
          DeepSeekAPI.clearScenarioHistory(currentCharacter.id, scenarioState.eventId);
        } else {
          DeepSeekAPI.clearChatHistory(currentCharacter.id);
        }
        renderChatMessages();
      }
    });
    $("#endScenarioBtn").addEventListener("click", () => endScenarioEvent());

    const shortBtn = $("#shortModeBtn");
    const longBtn = $("#longModeBtn");
    if (shortBtn && longBtn) {
      shortBtn.addEventListener("click", () => {
        window.chatMode = "short";
        shortBtn.classList.add("active");
        longBtn.classList.remove("active");
      });
      longBtn.addEventListener("click", () => {
        window.chatMode = "long";
        longBtn.classList.add("active");
        shortBtn.classList.remove("active");
      });
    }
  }

  function renderChatMessages() {
    if (!currentCharacter) return;
    const messages = getActiveChatHistory();
    const container = $("#chatMessages");
    const savedSummary = scenarioState.active && scenarioState.event
      ? getEventSummary(currentCharacter, scenarioState.event)
      : "";

    if (messages.length === 0) {
      const placeholder = scenarioState.active && scenarioState.event
        ? `……（${scenarioState.event.title} · ${scenarioState.event.mood}）`
        : `……（${currentCharacter.name} 似乎正在等待你开口）`;
      container.innerHTML = `
        <div class="chat-msg assistant">
          <div class="chat-msg-avatar">${renderAvatarInner(currentCharacter)}</div>
          <div class="chat-bubble">${placeholder}</div>
        </div>
        ${savedSummary ? `
          <div class="chat-msg assistant scenario-summary-msg">
            <div class="chat-msg-avatar">📜</div>
            <div class="chat-bubble scenario-summary-bubble">
              <strong>【事件总结】</strong><br>${escapeHtml(savedSummary)}
            </div>
          </div>
        ` : ""}
      `;
      return;
    }

    container.innerHTML = messages.map(m => {
      const isUser = m.role === "user";
      return `
        <div class="chat-msg ${isUser ? "user" : "assistant"}">
          <div class="chat-msg-avatar">${isUser ? "🧑" : renderAvatarInner(currentCharacter)}</div>
          <div class="chat-bubble">${escapeHtml(m.content)}</div>
        </div>
      `;
    }).join("");

    if (savedSummary) {
      container.innerHTML += `
        <div class="chat-msg assistant scenario-summary-msg">
          <div class="chat-msg-avatar">📜</div>
          <div class="chat-bubble scenario-summary-bubble">
            <strong>【事件总结】</strong><br>${escapeHtml(savedSummary)}
          </div>
        </div>
      `;
    }

    container.scrollTop = container.scrollHeight;
  }

  async function sendChat() {
    if (!currentCharacter || isSending) return;

    const input = $("#chatInput");
    const text = input.value.trim();
    if (!text) return;

    isSending = true;
    $("#sendChatBtn").disabled = true;

    const history = getActiveChatHistory();
    history.push({ role: "user", content: text });
    saveActiveChatHistory(history);
    input.value = "";
    renderChatMessages();

    const container = $("#chatMessages");
    container.innerHTML += `
      <div class="chat-msg assistant loading" id="loadingMsg">
        <div class="chat-msg-avatar">${renderAvatarInner(currentCharacter)}</div>
        <div class="chat-bubble">思考中…</div>
      </div>
    `;
    container.scrollTop = container.scrollHeight;

    const shouldEndScenario = checkEndingTriggers(text);

    try {
      const reply = await DeepSeekAPI.sendMessage(
        getActiveSystemPrompt(),
        history.slice(0, -1),
        text
      );
      history.push({ role: "assistant", content: reply });
      saveActiveChatHistory(history);
    } catch (err) {
      history.pop();
      saveActiveChatHistory(history);
      alert(err.message);
    } finally {
      isSending = false;
      $("#sendChatBtn").disabled = false;
      renderChatMessages();
      if (shouldEndScenario && scenarioState.active) {
        await endScenarioEvent();
      }
    }
  }

  /* ── 群聊 ── */
  function bindGroupChat() {
    renderGroupCharOptions();

    $("#createGroupChatBtn").addEventListener("click", openGroupChatSetup);
    $("#groupChatClose").addEventListener("click", closeGroupChatModal);
    $("#groupChatCancel").addEventListener("click", closeGroupChatModal);
    $("#groupChatBackdrop").addEventListener("click", closeGroupChatModal);

    $("#groupRoleType").addEventListener("change", toggleUserRoleFields);
    $("#startGroupChatBtn").addEventListener("click", startGroupChat);
    $("#leaveGroupChatBtn").addEventListener("click", leaveGroupChat);
    $("#sendGroupChatBtn").addEventListener("click", sendGroupChat);

    $("#groupChatInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendGroupChat();
      }
    });
  }

  function renderGroupCharOptions() {
    const checkboxContainer = $("#groupCharCheckboxes");
    checkboxContainer.innerHTML = CHARACTERS.map(ch => `
      <label class="group-char-item">
        <input type="checkbox" name="groupChar" value="${ch.id}">
        <span class="group-char-avatar">${renderAvatarInner(ch)}</span>
        <span class="group-char-name">${ch.name}</span>
      </label>
    `).join("");

    const existingSelect = $("#groupExistingChar");
    existingSelect.innerHTML = CHARACTERS.map(ch =>
      `<option value="${ch.id}">${ch.name}</option>`
    ).join("");
  }

  function toggleUserRoleFields() {
    const isCustom = $("#groupRoleType").value === "custom";
    $("#groupExistingRole").hidden = isCustom;
    $("#groupCustomRole").hidden = !isCustom;
  }

  function openGroupChatSetup() {
    if (groupChatState.active) {
      showGroupChatWindow();
      return;
    }
    resetGroupChatForm();
    $("#groupChatSetup").hidden = false;
    $("#groupChatWindow").hidden = true;
    $("#groupChatModal").hidden = false;
  }

  function closeGroupChatModal() {
    if (groupChatState.active) return;
    $("#groupChatModal").hidden = true;
  }

  function resetGroupChatForm() {
    $$('input[name="groupChar"]').forEach(cb => { cb.checked = false; });
    $("#groupTime").value = "";
    $("#groupLocation").value = "";
    $("#groupBackground").value = "";
    $("#groupRoleType").value = "existing";
    toggleUserRoleFields();
    $("#groupExistingChar").selectedIndex = 0;
    $("#customName").value = "";
    $("#customGender").value = "";
    $("#customIdentity").value = "";
    $("#customRelations").value = "";
    $("#customOther").value = "";
  }

  function getUserRoleName() {
    if (!groupChatState.userRole) return "你";
    if (groupChatState.userRole.type === "existing") {
      const ch = CHARACTERS.find(c => c.id === groupChatState.userRole.characterId);
      return ch ? ch.name : "你";
    }
    return groupChatState.userRole.custom.name || "你";
  }

  function buildUserRoleFromForm() {
    const type = $("#groupRoleType").value;
    if (type === "existing") {
      return { type: "existing", characterId: $("#groupExistingChar").value };
    }
    return {
      type: "custom",
      custom: {
        name: $("#customName").value.trim(),
        gender: $("#customGender").value.trim(),
        identity: $("#customIdentity").value.trim(),
        relations: $("#customRelations").value.trim(),
        other: $("#customOther").value.trim()
      }
    };
  }

  function validateGroupChatForm() {
    const selectedIds = [...$$('input[name="groupChar"]:checked')].map(cb => cb.value);
    if (selectedIds.length < 2) {
      alert("请至少选择 2 名参与角色");
      return null;
    }

    const userRole = buildUserRoleFromForm();
    if (userRole.type === "custom" && !userRole.custom.name) {
      alert("自拟角色请填写姓名");
      return null;
    }

    return {
      selectedIds,
      time: $("#groupTime").value.trim(),
      location: $("#groupLocation").value.trim(),
      background: $("#groupBackground").value.trim(),
      userRole
    };
  }

  function buildCharacterBrief(ch) {
    const prompt = ch.systemPrompt || "";
    const brief = prompt.replace(/^你是[^，。]+[，。]/, "").slice(0, 120);
    return `- ${ch.name}（${ch.identity}）：${brief || ch.fullInfo.slice(0, 80)}`;
  }

  function buildGroupSystemPrompt() {
    const { selectedCharacters, time, location, background, userRole } = groupChatState;
    const charBriefs = selectedCharacters.map(buildCharacterBrief).join("\n");
    const participantNames = selectedCharacters.map(c => c.name).join("、");

    let userRoleDesc;
    if (userRole.type === "existing") {
      const ch = CHARACTERS.find(c => c.id === userRole.characterId);
      userRoleDesc = ch
        ? `用户扮演已有角色「${ch.name}」。${ch.systemPrompt}`
        : "用户扮演已有角色。";
    } else {
      const c = userRole.custom;
      userRoleDesc = `用户扮演自拟角色：
- 姓名：${c.name}
- 性别：${c.gender || "未设定"}
- 身份：${c.identity || "未设定"}
- 与其他角色关系：${c.relations || "未设定"}
- 其他：${c.other || "无"}`;
    }

    return `${WORLD_SETTING}

---

【你的身份】
你同时担任本场景的旁白与以下 NPC 角色的扮演者：${participantNames}。
你需要根据情境合理安排角色出场，不必让每个角色每轮都发言，但要保持各角色性格一致。

【参与角色性格摘要】
${charBriefs}

【场景设定】
- 时间：${time || "未指定"}
- 地点：${location || "未指定"}
- 背景：${background || "自由发挥"}

【用户扮演】
${userRoleDesc}
用户的每次发言会以【${getUserRoleName()}】: 开头出现在对话记录中，你需要以旁白和其他角色的反应回应。

【输出格式要求】
1. 角色台词必须使用格式：【角色名】: 台词内容
2. 环境描写、动作、心理等旁白叙述直接书写，不要加【】前缀
3. 一次回复可包含旁白与多个角色的发言，按剧情自然穿插
4. 严格遵循世界观设定，勿编造与设定冲突的内容
5. 用中文回复，保持沉浸式小说感`;
  }

  function historyToPlainText(history) {
    return history.map(entry => {
      if (entry.role === "user") {
        return `【${entry.sender || getUserRoleName()}】: ${entry.content}`;
      }
      return entry.content;
    }).join("\n\n");
  }

  function startGroupChat() {
    const form = validateGroupChatForm();
    if (!form) return;

    if (!DeepSeekAPI.getApiKey()) {
      alert("请先在「API 设置」中填入 DeepSeek API Key");
      return;
    }

    groupChatState = {
      active: true,
      selectedCharacters: form.selectedIds.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean),
      time: form.time,
      location: form.location,
      background: form.background,
      userRole: form.userRole,
      history: [],
      systemPrompt: ""
    };
    groupChatState.systemPrompt = buildGroupSystemPrompt();

    showGroupChatWindow();
    requestInitialGroupScene();
  }

  function showGroupChatWindow() {
    const names = groupChatState.selectedCharacters.map(c => c.name).join("、");
    $("#groupChatTitle").textContent = `群聊 · ${names}`;
    $("#groupChatMeta").textContent = [
      groupChatState.time,
      groupChatState.location
    ].filter(Boolean).join(" · ") || "情境群聊";
    $("#groupChatSetup").hidden = true;
    $("#groupChatWindow").hidden = false;
    $("#groupChatModal").hidden = false;
    renderGroupChatMessages();
    $("#groupChatInput").focus();
  }

  async function requestInitialGroupScene() {
    isGroupSending = true;
    $("#sendGroupChatBtn").disabled = true;
    appendGroupLoading();

    try {
      const reply = await DeepSeekAPI.callDeepSeek([
        { role: "system", content: groupChatState.systemPrompt },
        {
          role: "user",
          content: "请根据场景设定，以旁白开启场景，并让合适的角色自然出场。不要替用户扮演的角色发言。"
        }
      ], { maxTokens: 1500, temperature: 0.88 });

      groupChatState.history.push({ role: "assistant", content: reply });
      renderGroupChatMessages();
    } catch (err) {
      alert(err.message);
    } finally {
      isGroupSending = false;
      $("#sendGroupChatBtn").disabled = false;
      removeGroupLoading();
      renderGroupChatMessages();
    }
  }

  function leaveGroupChat() {
    if (groupChatState.history.length > 0) {
      if (!confirm("确定离开群聊？当前对话不会保存。")) return;
    }
    groupChatState = {
      active: false,
      selectedCharacters: [],
      time: "",
      location: "",
      background: "",
      userRole: null,
      history: [],
      systemPrompt: ""
    };
    $("#groupChatModal").hidden = true;
    $("#groupChatSetup").hidden = false;
    $("#groupChatWindow").hidden = true;
    resetGroupChatForm();
  }

  function getCharAvatar(name) {
    const ch = CHARACTERS.find(c => c.name === name);
    if (ch) return renderAvatarInner(ch);
    if (name === getUserRoleName()) return "🧑";
    if (name === "旁白") return "📖";
    return "💬";
  }

  function parseGroupMessageSegments(content) {
    const segments = [];
    const parts = content.split(/(?=【[^】]+】[:：])/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^【([^】]+)】[:：]\s*([\s\S]*)$/);
      if (match) {
        segments.push({ sender: match[1].trim(), content: match[2].trim() });
      } else {
        segments.push({ sender: "旁白", content: trimmed });
      }
    }

    if (segments.length === 0) {
      segments.push({ sender: "旁白", content: content.trim() });
    }
    return segments;
  }

  function renderGroupChatMessages() {
    const container = $("#groupChatMessages");
    if (groupChatState.history.length === 0) {
      container.innerHTML = `<div class="group-chat-empty">场景加载中…</div>`;
      return;
    }

    const userName = getUserRoleName();
    let html = "";

    groupChatState.history.forEach(entry => {
      if (entry.role === "user") {
        html += `
          <div class="group-msg user">
            <div class="group-msg-avatar">${getCharAvatar(entry.sender)}</div>
            <div class="group-msg-body">
              <div class="group-msg-sender">${escapeHtml(entry.sender)}</div>
              <div class="group-msg-bubble">${escapeHtml(entry.content)}</div>
            </div>
          </div>`;
        return;
      }

      const segments = parseGroupMessageSegments(entry.content);
      segments.forEach(seg => {
        const isNarrator = seg.sender === "旁白";
        html += `
          <div class="group-msg ${isNarrator ? "narrator" : "npc"}">
            <div class="group-msg-avatar">${getCharAvatar(seg.sender)}</div>
            <div class="group-msg-body">
              <div class="group-msg-sender">${escapeHtml(seg.sender)}</div>
              <div class="group-msg-bubble">${escapeHtml(seg.content)}</div>
            </div>
          </div>`;
      });
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  function appendGroupLoading() {
    const container = $("#groupChatMessages");
    container.innerHTML += `
      <div class="group-msg narrator loading" id="groupLoadingMsg">
        <div class="group-msg-avatar">📖</div>
        <div class="group-msg-body">
          <div class="group-msg-sender">旁白</div>
          <div class="group-msg-bubble">正在续写…</div>
        </div>
      </div>`;
    container.scrollTop = container.scrollHeight;
  }

  function removeGroupLoading() {
    $("#groupLoadingMsg")?.remove();
  }

  async function sendGroupChat() {
    if (!groupChatState.active || isGroupSending) return;

    const input = $("#groupChatInput");
    const text = input.value.trim();
    if (!text) return;

    isGroupSending = true;
    $("#sendGroupChatBtn").disabled = true;

    const sender = getUserRoleName();
    const userEntry = { role: "user", content: text, sender };
    groupChatState.history.push(userEntry);
    input.value = "";
    renderGroupChatMessages();
    appendGroupLoading();

    const transcript = historyToPlainText(groupChatState.history);

    try {
      const reply = await DeepSeekAPI.callDeepSeek([
        { role: "system", content: groupChatState.systemPrompt },
        {
          role: "user",
          content: `以下是截至目前的完整对话记录：\n\n${transcript}\n\n请继续推进剧情，回应【${sender}】的最新发言。不要替【${sender}】发言。`
        }
      ], { maxTokens: 1500, temperature: 0.88 });

      groupChatState.history.push({ role: "assistant", content: reply });
    } catch (err) {
      groupChatState.history.pop();
      alert(err.message);
    } finally {
      isGroupSending = false;
      $("#sendGroupChatBtn").disabled = false;
      removeGroupLoading();
      renderGroupChatMessages();
    }
  }

  /* ── API 设置弹窗 ── */
  function bindSettings() {
    const modal = $("#settingsModal");

    $("#settingsBtn").addEventListener("click", () => {
      $("#apiKeyInput").value = DeepSeekAPI.getApiKey();
      $("#apiModelInput").value = DeepSeekAPI.getModel();
      modal.hidden = false;
    });

    $("#settingsClose").addEventListener("click", () => modal.hidden = true);
    $("#settingsBackdrop").addEventListener("click", () => modal.hidden = true);
    $("#settingsCancel").addEventListener("click", () => modal.hidden = true);

    $("#settingsSave").addEventListener("click", () => {
      DeepSeekAPI.setApiKey($("#apiKeyInput").value.trim());
      DeepSeekAPI.setModel($("#apiModelInput").value.trim() || "deepseek-chat");
      modal.hidden = true;
    });
  }

  /* ── 工具函数 ── */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML.replace(/\n/g, "<br>");
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ── 启动 ── */
  document.addEventListener("DOMContentLoaded", init);
})();