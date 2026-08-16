"use strict";

var UR = {
  HOST_ID: "universal-remote-host",
  CONFIRM_MS: 8000,
};

UR.ACTIONS = {
  seekBack60: { id: "seekBack60", label: "快退 1 分钟", group: "media", delta: -60 },
  seekBack10: { id: "seekBack10", label: "快退 10 秒", group: "media", delta: -10 },
  playPause: { id: "playPause", label: "播放 / 暂停", group: "media" },
  seekForward10: { id: "seekForward10", label: "快进 10 秒", group: "media", delta: 10 },
  seekForward60: { id: "seekForward60", label: "快进 1 分钟", group: "media", delta: 60 },
  prevPage: { id: "prevPage", label: "上一页", group: "nav", dir: -1 },
  nextPage: { id: "nextPage", label: "下一页", group: "nav", dir: 1 },
};

const WEAK_NAV = new Set(["next", "prev", "previous", "newer", "older", "下一个", "上一个"]);

const SITE_ADAPTERS = [
  {
    test: (h) => /youtube\.com|youtu\.be/.test(h),
    selectors: {
      playPause: [
        ".ytp-play-button",
        "button.ytp-play-button",
        ".ytm-play-button",
        "#play-pause-button",
        "button[aria-label*='Play' i]",
        "button[aria-label*='Pause' i]",
        "button[aria-label*='播放']",
        "button[aria-label*='暂停']",
      ],
      nextPage: [".ytp-next-button", "a.ytp-next-button", ".ytp-endscreen-next"],
      prevPage: [".ytp-prev-button", "a.ytp-prev-button"],
    },
  },
  {
    test: (h) => /bilibili\.com/.test(h),
    selectors: {
      playPause: [
        ".bpx-player-ctrl-play",
        ".bilibili-player-video-btn-start",
        ".squirtle-video-start",
      ],
      nextPage: [
        ".bpx-player-ctrl-next",
        ".bilibili-player-video-btn-next",
        ".squirtle-video-next",
        ".next-button",
      ],
      prevPage: [".bpx-player-ctrl-prev", ".bilibili-player-video-btn-prev"],
    },
  },
  {
    test: (h) => /iqiyi\.com/.test(h),
    selectors: {
      playPause: [".iqp-btn-pauseplay", ".iqp-player-playbtn"],
      nextPage: [".iqp-btn-next", ".iqp-next"],
      prevPage: [".iqp-btn-prev"],
    },
  },
  {
    test: (h) => /youku\.com/.test(h),
    selectors: {
      playPause: [".kui-play-icon-0", ".control-play-btn"],
      nextPage: [".kui-next-icon-0", ".control-next-btn"],
      prevPage: [".kui-prev-icon-0"],
    },
  },
  {
    test: (h) => /v\.qq\.com|video\.qq\.com/.test(h),
    selectors: {
      playPause: [".txp_btn_play", ".txp-play-btn"],
      nextPage: [".txp_btn_next", ".txp-next-btn"],
      prevPage: [".txp_btn_prev"],
    },
  },
  {
    test: (h) => /netflix\.com/.test(h),
    selectors: {
      playPause: [
        'button[data-uia="control-play-pause-play"]',
        'button[data-uia="control-play-pause-pause"]',
        "button.button-nfplayerPlay",
        "button.button-nfplayerPause",
      ],
      seekBack10: ['button[data-uia="control-back10"]'],
      seekForward10: ['button[data-uia="control-forward10"]'],
      nextPage: [
        'button[data-uia="next-episode-seamless-button"]',
        'button[data-uia="control-next"]',
        "button.next-episode-button",
      ],
    },
  },
  {
    test: (h) => /twitch\.tv/.test(h),
    selectors: {
      playPause: ['button[data-a-target="player-play-pause-button"]'],
    },
  },
  {
    test: (h) => true,
    selectors: {
      playPause: [
        ".dplayer-play-icon",
        ".xgplayer-play",
        ".plyr__control[data-plyr='play']",
        ".vjs-play-control",
        ".jw-icon-playback",
        "button[class*='play-pause' i]",
        "button[class*='playpause' i]",
      ],
      nextPage: [
        ".dplayer-next-icon",
        "a[rel='next']",
        "link[rel='next']",
      ],
      prevPage: [
        "a[rel='prev']",
        "a[rel='previous']",
        "link[rel='prev']",
      ],
    },
  },
];

const TEXT = {
  playPause: [
    "播放",
    "暂停",
    "play",
    "pause",
    "播放/暂停",
    "play/pause",
  ],
  play: ["播放", "play", "watch", "继续播放"],
  pause: ["暂停", "pause"],
  seekBack10: [
    "快退10秒",
    "后退10秒",
    "倒退10秒",
    "回退10秒",
    "rewind 10",
    "back 10",
    "seek backward 10",
    "-10s",
    "-10秒",
  ],
  seekForward10: [
    "快进10秒",
    "前进10秒",
    "向前10秒",
    "forward 10",
    "seek forward 10",
    "skip 10",
    "+10s",
    "+10秒",
    "10秒",
  ],
  seekBack60: [
    "快退1分钟",
    "快退60秒",
    "后退1分钟",
    "倒退1分钟",
    "rewind 60",
    "back 60",
    "seek backward 60",
    "-1min",
    "-60s",
    "-1分",
  ],
  seekForward60: [
    "快进1分钟",
    "快进60秒",
    "前进1分钟",
    "forward 60",
    "seek forward 60",
    "+1min",
    "+60s",
    "+1分",
  ],
  nextPage: [
    "下一页",
    "下页",
    "后页",
    "下一章",
    "下一话",
    "下一集",
    "下一篇",
    "下一部",
    "下一个",
    "后一篇",
    "后一章",
    "后一集",
    "下一节",
    "next page",
    "next episode",
    "next chapter",
    "next video",
    "next",
    "newer",
  ],
  prevPage: [
    "上一页",
    "上页",
    "前页",
    "上一章",
    "上一话",
    "上一集",
    "上一篇",
    "上一部",
    "上一个",
    "前一篇",
    "前一章",
    "前一集",
    "上一节",
    "previous page",
    "prev page",
    "previous episode",
    "prev episode",
    "previous chapter",
    "previous",
    "prev",
    "older",
  ],
};

const NEGATIVE = [
  "广告",
  "advert",
  "sponsor",
  "promo",
  "skip ad",
  "跳过广告",
  "关闭广告",
  "login",
  "登录",
  "sign in",
  "注册",
  "download app",
  "打开app",
  "分享",
  "share",
];

function isOurHost(el) {
  if (!el || !el.closest) return false;
  if (el.closest("#" + UR.HOST_ID)) return true;
  const root = el.getRootNode && el.getRootNode();
  if (root && root.host && root.host.id === UR.HOST_ID) return true;
  return false;
}

function queryAllDeep(selector, root = document) {
  const out = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    let found = [];
    try {
      found = node.querySelectorAll ? Array.from(node.querySelectorAll(selector)) : [];
    } catch {
      found = [];
    }
    for (const el of found) {
      if (!isOurHost(el)) out.push(el);
    }
    let all = [];
    try {
      all = node.querySelectorAll ? Array.from(node.querySelectorAll("*")) : [];
    } catch {
      all = [];
    }
    for (const el of all) {
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  visit(root);
  return out;
}

function getLabel(el) {
  if (!el) return "";
  const bits = [
    el.getAttribute && el.getAttribute("aria-label"),
    el.getAttribute && el.getAttribute("title"),
    el.getAttribute && el.getAttribute("data-title"),
    el.getAttribute && el.getAttribute("data-tooltip"),
    el.getAttribute && el.getAttribute("alt"),
    el.getAttribute && el.getAttribute("data-uia"),
    el.getAttribute && el.getAttribute("data-a-target"),
    el.value,
    el.textContent,
  ];
  return bits
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalize(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .toLowerCase();
}

function isVisible(el, { allowHiddenInPlayer = true } = {}) {
  if (!el || el.nodeType !== 1) return false;
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
  const style = window.getComputedStyle(el);
  if (!style || style.display === "none") return false;
  const rect = el.getBoundingClientRect();
  const tiny = rect.width < 2 && rect.height < 2;
  const hidden = style.visibility === "hidden" || Number(style.opacity) === 0;
  if (tiny && hidden) {
    return allowHiddenInPlayer && isInPlayer(el);
  }
  if (hidden) return allowHiddenInPlayer && isInPlayer(el);
  if (tiny) {
    const host = el.closest("button, a, [role='button'], [role='link']");
    if (host && host !== el) return isVisible(host, { allowHiddenInPlayer });
    return allowHiddenInPlayer && isInPlayer(el);
  }
  return true;
}

function isInPlayer(el) {
  if (!el.closest) return false;
  if (
    el.closest(
      "[class*='player' i], [class*='video' i], [id*='player' i], [id*='video' i], .ytp-chrome-bottom, .bpx-player, .txp_player, .iqp-player, .dplayer, .xgplayer, .jwplayer, .plyr"
    )
  ) {
    return true;
  }
  const media = getPrimaryMedia();
  if (!media) return false;
  const wrap = media.parentElement;
  return !!(wrap && wrap.contains(el));
}

function isClickableTag(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (["BUTTON", "A", "SUMMARY"].includes(tag)) return true;
  if (tag === "INPUT") {
    const t = (el.type || "").toLowerCase();
    return ["button", "submit", "image"].includes(t);
  }
  const role = (el.getAttribute("role") || "").toLowerCase();
  if (["button", "link", "menuitem", "tab"].includes(role)) return true;
  if (el.hasAttribute("onclick") || el.hasAttribute("ng-click")) return true;
  const tabindex = el.getAttribute("tabindex");
  if (tabindex !== null && tabindex !== "-1") return true;
  return false;
}

function closestClickable(el) {
  let cur = el;
  for (let i = 0; i < 5 && cur; i++) {
    if (isClickableTag(cur)) return cur;
    cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
  }
  return isClickableTag(el) ? el : el;
}

function hasNegative(label) {
  const n = normalize(label);
  return NEGATIVE.some((w) => n.includes(normalize(w)));
}

function textMatches(label, phrases, { exactish = false } = {}) {
  const raw = String(label || "").toLowerCase();
  const compact = normalize(raw);
  for (const p of phrases) {
    const pc = normalize(p);
    if (!pc) continue;
    if (compact === pc) return 50;
    if (compact.includes(pc)) {
      if (exactish && Math.abs(compact.length - pc.length) > 10) continue;
      return 36;
    }
    if (raw.includes(String(p).toLowerCase())) return 30;
  }
  return 0;
}

function simulateClick(el) {
  if (!el) return false;
  try {
    if (el.tagName === "LINK" && el.href) {
      window.location.href = el.href;
      return true;
    }
    const target = closestClickable(el);
    target.focus && target.focus({ preventScroll: true });
    const opts = { bubbles: true, cancelable: true, view: window, composed: true };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new MouseEvent("mousedown", opts));
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("mouseup", opts));
    target.dispatchEvent(new MouseEvent("click", opts));
    if (typeof target.click === "function") target.click();
    return true;
  } catch {
    try {
      el.click();
      return true;
    } catch {
      return false;
    }
  }
}

function getAllMedia() {
  return queryAllDeep("video, audio").filter((m) => {
    if (isOurHost(m)) return false;
    const rect = m.getBoundingClientRect();
    return m.readyState > 0 || rect.width > 16 || rect.height > 16 || !m.paused;
  });
}

function getPrimaryMedia() {
  const all = getAllMedia();
  if (!all.length) return null;
  const playing = all.filter((m) => !m.paused && !m.ended);
  const pool = playing.length ? playing : all;
  pool.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const as = (ar.width || a.videoWidth || 1) * (ar.height || a.videoHeight || 1);
    const bs = (br.width || b.videoWidth || 1) * (br.height || b.videoHeight || 1);
    return bs - as;
  });
  return pool[0] || null;
}

function mediaState() {
  const media = getPrimaryMedia();
  if (!media) return { exists: false, paused: true, currentTime: 0, duration: 0 };
  return {
    exists: true,
    paused: media.paused || media.ended,
    currentTime: media.currentTime || 0,
    duration: Number.isFinite(media.duration) ? media.duration : 0,
  };
}

function hostname() {
  try {
    return location.hostname || "";
  } catch {
    return "";
  }
}

function adapterSelectors(actionId) {
  const host = hostname();
  const list = [];
  for (const adapter of SITE_ADAPTERS) {
    try {
      if (!adapter.test(host)) continue;
    } catch {
      continue;
    }
    const sels = adapter.selectors[actionId] || [];
    list.push(...sels);
  }
  return list;
}

function scoreCandidate(el, actionId) {
  if (!el || isOurHost(el)) return -Infinity;
  if (!isVisible(el)) return -Infinity;
  const label = getLabel(el);
  if (hasNegative(label)) return -20;

  let score = 0;
  const phrases = TEXT[actionId] || [];
  const hit = textMatches(label, phrases);
  score += hit;
  const compact = normalize(label);
  const onlyWeakNav =
    (actionId === "nextPage" || actionId === "prevPage") &&
    hit > 0 &&
    WEAK_NAV.has(compact);
  if (onlyWeakNav) {
    const inNav = !!(el.closest && el.closest("nav, .pagination, .pager, [class*='paginat' i]"));
    if (!inNav && !isInPlayer(el)) score -= 24;
  }

  const cls = `${el.className || ""} ${el.id || ""}`.toLowerCase();
  if (actionId === "nextPage" && /next|forward|后一|下一/.test(cls)) score += 12;
  if (actionId === "prevPage" && /prev|previous|back|前一|上一/.test(cls)) score += 12;
  if (actionId === "playPause" && /play|pause|播放|暂停/.test(cls)) score += 12;

  const rel = (el.getAttribute("rel") || "").toLowerCase();
  if (actionId === "nextPage" && /\bnext\b/.test(rel)) score += 40;
  if (actionId === "prevPage" && /\bprev|previous\b/.test(rel)) score += 40;

  if (["nextPage", "prevPage"].includes(actionId)) {
    if (el.closest && el.closest("nav, .pagination, .pager, [class*='paginat' i], [class*='page-nav' i]")) {
      score += 16;
    }
    if (isInPlayer(el) && /集|话|章|episode|chapter/.test(label)) score += 18;
  }

  if (actionId.startsWith("seek") || actionId === "playPause") {
    if (isInPlayer(el)) score += 14;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width * rect.height > 4) score += 4;

  return score;
}

function findBySelectors(selectors) {
  const found = [];
  for (const sel of selectors) {
    try {
      found.push(...queryAllDeep(sel));
    } catch {
      /* invalid selector */
    }
  }
  return found;
}

function clickablePool() {
  return queryAllDeep(
    "a, button, [role='button'], [role='link'], input, summary, [onclick], [tabindex], .bpx-player-ctrl-btn, .ytp-button"
  );
}

function findNativeButton(actionId) {
  const scored = [];

  if (actionId === "nextPage" || actionId === "prevPage") {
    const rel = actionId === "nextPage" ? "next" : "prev";
    for (const el of queryAllDeep(`link[rel='${rel}'], link[rel='${rel === "prev" ? "previous" : "next"}']`)) {
      if (el.href) scored.push({ el, score: 45, via: "rel-link" });
    }
  }

  for (const el of findBySelectors(adapterSelectors(actionId))) {
    const s = el.tagName === "LINK" ? 44 : scoreCandidate(el, actionId);
    if (s > -10) scored.push({ el: closestClickable(el), score: s + 24, via: "adapter" });
  }

  const pool = clickablePool();
  if (actionId === "playPause") {
    const media = getPrimaryMedia();
    const wantPlay = !media || media.paused || media.ended;
    const extra = wantPlay ? TEXT.play : TEXT.pause;
    for (const el of pool) {
      const s = scoreCandidate(el, "playPause") + textMatches(getLabel(el), extra) * 0.2;
      if (s >= 30) scored.push({ el: closestClickable(el), score: s, via: "text" });
    }
  } else {
    for (const el of pool) {
      const s = scoreCandidate(el, actionId);
      if (s >= 30) scored.push({ el: closestClickable(el), score: s, via: "text" });
    }
  }

  if (actionId === "nextPage" || actionId === "prevPage") {
    const numbered = findNumberedPageLink(actionId === "nextPage" ? 1 : -1);
    if (numbered) scored.push({ el: numbered, score: 28, via: "page-number" });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((x) => x.el && x.score >= 28);
  return best || null;
}

function findNumberedPageLink(dir) {
  const current = queryAllDeep(
    "[aria-current='page'], .pagination .active, .pagination .current, .pager .active, .page-item.active, .current-page"
  ).find((el) => isVisible(el, { allowHiddenInPlayer: false }));

  const curText = current ? (current.textContent || "").trim() : "";
  let n = parseInt(curText, 10);
  if (!Number.isFinite(n)) {
    const m = /(?:page|p|pn)=(\d+)/i.exec(location.search);
    if (m) n = parseInt(m[1], 10);
  }
  if (!Number.isFinite(n)) return null;
  const target = String(n + dir);
  if (parseInt(target, 10) < 1) return null;

  const links = queryAllDeep("a, button, [role='button']");
  for (const el of links) {
    if (!isVisible(el, { allowHiddenInPlayer: false })) continue;
    const t = (el.textContent || "").trim();
    if (t === target && !hasNegative(getLabel(el))) return el;
  }
  return null;
}

function applySeek(media, delta) {
  const dur = Number.isFinite(media.duration) ? media.duration : Number.POSITIVE_INFINITY;
  const next = Math.min(dur, Math.max(0, (media.currentTime || 0) + delta));
  media.currentTime = next;
  return { ok: true, method: "media.currentTime", detail: next };
}

function applyPlayPause(media) {
  if (media.paused || media.ended) {
    const p = media.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
    return { ok: true, method: "media.play" };
  }
  media.pause();
  return { ok: true, method: "media.pause" };
}

function sendKey(key, code, keyCode) {
  const media = getPrimaryMedia();
  const target = document.activeElement && document.activeElement !== document.body
    ? document.activeElement
    : media || document.body;
  const opts = {
    key,
    code,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  try {
    target.dispatchEvent(new KeyboardEvent("keydown", opts));
    target.dispatchEvent(new KeyboardEvent("keyup", opts));
    return true;
  } catch {
    return false;
  }
}

function forceSeek(delta) {
  const media = getPrimaryMedia();
  if (media) return applySeek(media, delta);

  if (delta === -10) sendKey("ArrowLeft", "ArrowLeft", 37);
  else if (delta === 10) sendKey("ArrowRight", "ArrowRight", 39);
  else if (delta === -60) {
    for (let i = 0; i < 6; i++) sendKey("j", "KeyJ", 74);
  } else if (delta === 60) {
    for (let i = 0; i < 6; i++) sendKey("l", "KeyL", 76);
  }
  return { ok: false, reason: "没有检测到可控制的音视频" };
}

function forcePlayPause() {
  const media = getPrimaryMedia();
  if (media) return applyPlayPause(media);
  sendKey(" ", "Space", 32);
  sendKey("k", "KeyK", 75);
  return { ok: false, reason: "没有检测到可控制的音视频" };
}

const PAGE_PARAMS = ["page", "p", "pn", "pageno", "page_no", "pagenum", "page_num", "offset", "start"];

function forceNavigate(dir) {
  const url = new URL(location.href);

  for (const key of PAGE_PARAMS) {
    if (!url.searchParams.has(key)) continue;
    const raw = url.searchParams.get(key);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) continue;
    const next = n + dir;
    if (next < 0) continue;
    url.searchParams.set(key, String(next));
    location.href = url.toString();
    return { ok: true, method: "url-param:" + key };
  }

  const pathTried = bumpPathNumber(url, dir);
  if (pathTried) {
    location.href = pathTried;
    return { ok: true, method: "url-path" };
  }

  const numbered = findNumberedPageLink(dir);
  if (numbered && simulateClick(numbered)) {
    return { ok: true, method: "page-number" };
  }

  return {
    ok: false,
    reason: dir > 0 ? "无法识别下一页地址" : "无法识别上一页地址",
  };
}

function bumpPathNumber(url, dir) {
  const patterns = [
    /(\/page\/)(\d+)/i,
    /(\/p\/)(\d+)/i,
    /(\/pn\/)(\d+)/i,
    /(-page-)(\d+)/i,
    /(\/p)\.(\d+)/i,
  ];
  for (const re of patterns) {
    if (!re.test(url.pathname)) continue;
    const nextPath = url.pathname.replace(re, (_, a, n) => {
      const v = parseInt(n, 10) + dir;
      return a + String(Math.max(1, v));
    });
    if (nextPath !== url.pathname) {
      url.pathname = nextPath;
      return url.toString();
    }
  }
  return null;
}

UR.tryNative = function tryNative(actionId) {
  const meta = UR.ACTIONS[actionId];
  if (!meta) return { ok: false, reason: "unknown_action" };

  const hit = findNativeButton(actionId);
  if (hit && simulateClick(hit.el)) {
    return { ok: true, method: "click", via: hit.via, score: hit.score };
  }

  if (meta.group === "media") {
    const media = getPrimaryMedia();
    if (media) {
      if (actionId === "playPause") return applyPlayPause(media);
      if (typeof meta.delta === "number") return applySeek(media, meta.delta);
    }
  }

  return { ok: false, reason: "not_found" };
};

UR.force = function force(actionId) {
  const meta = UR.ACTIONS[actionId];
  if (!meta) return { ok: false, reason: "unknown_action" };
  if (actionId === "playPause") return forcePlayPause();
  if (typeof meta.delta === "number") return forceSeek(meta.delta);
  if (meta.group === "nav") return forceNavigate(meta.dir);
  return { ok: false, reason: "unsupported" };
};

UR.scanAvailability = function scanAvailability() {
  const out = {};
  for (const id of Object.keys(UR.ACTIONS)) {
    const hit = findNativeButton(id);
    out[id] = {
      button: !!(hit && hit.score >= 28),
      media: UR.ACTIONS[id].group === "media" && !!getPrimaryMedia(),
    };
  }
  return out;
};

UR.getMediaState = mediaState;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "UR_FRAME_ACTION") return false;
  try {
    const result = msg.force ? UR.force(msg.action) : UR.tryNative(msg.action);
    sendResponse(result);
  } catch (err) {
    sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) });
  }
  return false;
});
