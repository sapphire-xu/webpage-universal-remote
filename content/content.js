"use strict";

(() => {
const UR_BOOT = Math.random().toString(36).slice(2);
const UR_PREV_BOOT = globalThis.__urBootId;
globalThis.__urBootId = UR_BOOT;
if (UR_PREV_BOOT) {
  try {
    const stale = document.getElementById("universal-remote-host");
    if (stale) stale.remove();
  } catch {
    /* ignore */
  }
}

function extAlive() {
  try {
    return !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function extDead(err) {
  const text = String((err && err.message) || err || "");
  return !extAlive() || text.indexOf("Extension context invalidated") !== -1;
}

var UR = {
  HOST_ID: "universal-remote-host",
  CONFIRM_MS: 16000,
  VERSION: "1.4.4",
};
try {
  UR.VERSION = chrome.runtime.getManifest().version || UR.VERSION;
} catch {
  /* ignore */
}

UR.ACTIONS = {
  seekBack60: { id: "seekBack60", label: "快退 1 分钟", group: "media", delta: -60 },
  seekBack10: { id: "seekBack10", label: "快退 10 秒", group: "media", delta: -10 },
  playPause: { id: "playPause", label: "播放 / 暂停", group: "media" },
  seekForward10: { id: "seekForward10", label: "快进 10 秒", group: "media", delta: 10 },
  seekForward60: { id: "seekForward60", label: "快进 1 分钟", group: "media", delta: 60 },
  prevPage: { id: "prevPage", label: "上一页 / 上一封", group: "nav", dir: -1 },
  nextPage: { id: "nextPage", label: "下一页 / 下一封", group: "nav", dir: 1 },
};

const WEAK_NAV = new Set(["next", "prev", "previous", "newer", "older", "下一个", "上一个", "下一条", "上一条"]);

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
    test: (h) => /mail\.qq\.com|wx\.mail\.qq\.com|exmail\.qq\.com|foxmail\.com/.test(h),
    selectors: {
      nextPage: [
        'a[title*="下一封"]',
        'a[aria-label*="下一封"]',
        '[title="下一封"]',
        '[title*="下一封邮件"]',
        '[aria-label*="下一封"]',
        "#next",
        "#nextmail",
        "#btn_next",
        ".qm_ico_next",
        ".nextmail",
        '[data-cmd="next"]',
        '[data-action="next-mail"]',
        '[name="nextmail"]',
      ],
      prevPage: [
        'a[title*="上一封"]',
        'a[aria-label*="上一封"]',
        '[title="上一封"]',
        '[title*="上一封邮件"]',
        '[aria-label*="上一封"]',
        "#prev",
        "#prevmail",
        "#btn_prev",
        ".qm_ico_prev",
        ".prevmail",
        '[data-cmd="prev"]',
        '[data-action="prev-mail"]',
        '[name="prevmail"]',
      ],
    },
  },
  {
    test: (h) => /mail\.163\.com|mail\.126\.com|mail\.yeah\.net|qiye\.163\.com/.test(h),
    selectors: {
      nextPage: ['[title*="下一封"]', '[aria-label*="下一封"]', "#dvNext", ".js-component-next"],
      prevPage: ['[title*="上一封"]', '[aria-label*="上一封"]', "#dvPrev", ".js-component-prev"],
    },
  },
  {
    test: (h) => /mail\.google\.com/.test(h),
    selectors: {
      nextPage: [
        'div[aria-label="较旧"]',
        'div[aria-label="Older"]',
        'div[data-tooltip="较旧"]',
        'div[data-tooltip="Older"]',
        'div[aria-label*="较旧的对话"]',
      ],
      prevPage: [
        'div[aria-label="较新"]',
        'div[aria-label="Newer"]',
        'div[data-tooltip="较新"]',
        'div[data-tooltip="Newer"]',
        'div[aria-label*="较新的对话"]',
      ],
    },
  },
  {
    test: (h) => /outlook\.(office|live|office365)\.com|outlook\.com/.test(h),
    selectors: {
      nextPage: ['button[aria-label*="下一封"]', 'button[aria-label*="Next"]', 'button[name="Next"]'],
      prevPage: ['button[aria-label*="上一封"]', 'button[aria-label*="Previous"]', 'button[name="Previous"]'],
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
        "a.btn-next",
        ".btn-next",
        "a.next-btn",
        ".page-next",
        'img[src*="btn-next"]',
        'img[src*="next.png"]',
      ],
      prevPage: [
        "a[rel='prev']",
        "a[rel='previous']",
        "link[rel='prev']",
        "a.btn-prev",
        ".btn-prev",
        "a.prev-btn",
        ".page-prev",
        'img[src*="btn-prev"]',
        'img[src*="prev.png"]',
        'img[src*="btn-back"]',
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
    "下一封",
    "后一封",
    "下一封邮件",
    "下一封信",
    "下一条",
    "下一项",
    "下一条消息",
    "下一封郵件",
    "较旧",
    "更早",
    "next page",
    "next episode",
    "next chapter",
    "next video",
    "next message",
    "next mail",
    "next email",
    "older",
    "next",
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
    "上一封",
    "前一封",
    "上一封邮件",
    "上一封信",
    "上一条",
    "上一项",
    "上一条消息",
    "上一封郵件",
    "较新",
    "更新的",
    "previous page",
    "prev page",
    "previous episode",
    "prev episode",
    "previous chapter",
    "previous message",
    "previous mail",
    "previous email",
    "prev message",
    "newer",
    "previous",
    "prev",
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
  "搜索",
  "search",
  "查询",
  "收藏",
  "点赞",
  "投币",
  "关注",
  "评论",
  "favorite",
  "favourite",
  "like",
  "collect",
];

function isOurHost(el) {
  if (!el) return false;
  if (el.id === UR.HOST_ID) return true;
  try {
    if (el.closest && el.closest("#" + UR.HOST_ID)) return true;
  } catch {
    /* ignore */
  }
  try {
    const root = el.getRootNode && el.getRootNode();
    if (root && root.host && root.host.id === UR.HOST_ID) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isOurEvent(event) {
  if (!event) return false;
  try {
    const path = event.composedPath ? event.composedPath() : [];
    for (let i = 0; i < path.length; i++) {
      const n = path[i];
      if (!n) continue;
      if (n.id === UR.HOST_ID) return true;
      if (n.host && n.host.id === UR.HOST_ID) return true;
    }
  } catch {
    /* ignore */
  }
  return isOurHost(event.target);
}

function queryAllDeep(selector, root = document) {
  const out = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || seen.has(node)) return;
    if (node.id === UR.HOST_ID || isOurHost(node)) return;
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
      if (el.id === UR.HOST_ID || isOurHost(el)) continue;
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  visit(root);
  return out;
}

function getOwnText(el) {
  if (!el) return "";
  let out = "";
  for (const node of el.childNodes || []) {
    if (node.nodeType === 3) out += node.textContent || "";
  }
  return out.replace(/\s+/g, " ").trim();
}

function getLabel(el) {
  if (!el) return "";
  const attrs = [
    el.getAttribute && el.getAttribute("aria-label"),
    el.getAttribute && el.getAttribute("title"),
    el.getAttribute && el.getAttribute("data-title"),
    el.getAttribute && el.getAttribute("data-tooltip"),
    el.getAttribute && el.getAttribute("alt"),
    el.getAttribute && el.getAttribute("data-uia"),
    el.getAttribute && el.getAttribute("data-a-target"),
    el.getAttribute && el.getAttribute("data-cmd"),
    el.getAttribute && el.getAttribute("data-action"),
    el.getAttribute && el.getAttribute("data-name"),
    el.getAttribute && el.getAttribute("name"),
    el.value,
  ].filter(Boolean);
  const own = getOwnText(el);
  const full = (el.textContent || "").replace(/\s+/g, " ").trim();
  const short = own || (full.length <= 24 ? full : "");
  const img = el.querySelector && el.querySelector("img");
  if (img) {
    attrs.push(img.getAttribute("alt"), img.getAttribute("title"));
    const src = img.getAttribute("src") || "";
    const file = src.split("?")[0].split("/").pop() || "";
    if (file) attrs.push(file.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " "));
  }
  return [...attrs, short].join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}

const STRONG_NEXT_CLASS = /\b(btn[-_]?next|next[-_]?btn|page[-_]?next|icon[-_]?next|arrow[-_]?next)\b/i;
const STRONG_PREV_CLASS = /\b(btn[-_]?prev|prev[-_]?btn|btn[-_]?previous|page[-_]?prev|icon[-_]?prev|arrow[-_]?prev|btn[-_]?back)\b/i;

function normalize(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .toLowerCase();
}

function isInAppChrome(el) {
  if (!el || !el.closest) return false;
  return !!el.closest(
    "header, [role='toolbar'], [role='navigation'], [class*='toolbar' i], [class*='tool-bar' i], [class*='tool_bar' i], [class*='mailoper' i], [class*='readmail' i], [class*='mail-opt' i], [class*='toolwrap' i], [class*='action-bar' i]"
  );
}

function isDisplayed(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
  let cur = el;
  for (let i = 0; i < 14 && cur && cur.nodeType === 1; i++) {
    let style;
    try {
      style = window.getComputedStyle(cur);
    } catch {
      return false;
    }
    if (!style || style.display === "none") return false;
    cur = cur.parentElement;
  }
  return true;
}

const lastPtr = { x: null, y: null, t: 0 };
document.addEventListener(
  "pointerdown",
  (event) => {
    if (isOurHost(event.target)) return;
    lastPtr.x = event.clientX;
    lastPtr.y = event.clientY;
    lastPtr.t = Date.now();
  },
  true
);

function hitTestPoints() {
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const fresh = lastPtr.t && Date.now() - lastPtr.t < 60000;
  const pts = [];
  if (fresh && lastPtr.x != null) pts.push([lastPtr.x, lastPtr.y]);
  pts.push([vw * 0.5, vh * 0.5], [vw * 0.5, vh * 0.62], [vw * 0.5, vh * 0.38]);
  const hits = [];
  for (const [x, y] of pts) {
    let el = null;
    try {
      el = document.elementFromPoint(x, y);
    } catch {
      el = null;
    }
    if (el && !isOurHost(el)) hits.push(el);
  }
  return hits;
}

function findPageContainer(el) {
  if (!el) return null;
  let cur = el.parentElement;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    const token = `${cur.className || ""} ${cur.id || ""} ${cur.getAttribute("data-page") || ""} ${cur.getAttribute("data-index") || ""}`;
    if (/page|slide|screen|step|panel|scene|swiper-slide|fullpage|section/i.test(token)) {
      const r = cur.getBoundingClientRect();
      if (r.width >= 80 && r.height >= 80) return cur;
    }
    cur = cur.parentElement;
  }
  cur = el.parentElement;
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  while (cur && cur !== document.body) {
    const r = cur.getBoundingClientRect();
    if (r.width >= vw * 0.45 && r.height >= vh * 0.35) return cur;
    cur = cur.parentElement;
  }
  return el.parentElement || el;
}

function isMostlyOffscreen(el) {
  if (!el || !el.getBoundingClientRect) return true;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  if (r.right < 32 || r.bottom < 32 || r.left > vw - 32 || r.top > vh - 32) return true;
  let cur = el;
  for (let i = 0; i < 8 && cur && cur.nodeType === 1; i++) {
    try {
      const st = window.getComputedStyle(cur);
      if (st.visibility === "hidden" || Number(st.opacity) === 0) return true;
    } catch {
      return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

function contextFit(el) {
  const hits = hitTestPoints();
  const page = findPageContainer(el);
  let fit = 0;
  for (const hit of hits) {
    if (el.contains(hit) || hit.contains(el)) fit += 90;
    else if (page && page.contains(hit)) fit += 70;
  }
  if (page) {
    const token = `${page.className || ""} ${page.id || ""}`;
    if (/\b(active|current|show|on|visible|playing|selected|cur)\b/i.test(token)) fit += 36;
    const pr = viewportRank(page);
    fit += Math.min(48, (pr.inter || 0) / 18000);
    if (!pr.painted) fit -= 55;
    if (isMostlyOffscreen(page)) fit -= 90;
  }
  const vr = viewportRank(el);
  if (vr.inView) fit += 16;
  if (vr.painted) fit += 12;
  else fit -= 20;
  if (isMostlyOffscreen(el)) fit -= 70;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const fresh = lastPtr.t && Date.now() - lastPtr.t < 60000 && lastPtr.x != null;
  const px = fresh ? lastPtr.x : vw * 0.5;
  const py = fresh ? lastPtr.y : vh * 0.5;
  const d = Math.hypot(r.left + (r.width || 0) / 2 - px, r.top + (r.height || 0) / 2 - py);
  fit -= Math.min(45, d / 28);
  return fit;
}

function viewportRank(el) {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth || 1;
  const vh = window.innerHeight || 1;
  const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
  const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  const inter = ix * iy;
  const cx = r.left + (r.width || 0) / 2;
  const cy = r.top + (r.height || 0) / 2;
  const dist = Math.hypot(cx - vw / 2, cy - vh / 2);
  let painted = 1;
  try {
    const st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || Number(st.opacity) === 0) painted = 0;
  } catch {
    painted = 0;
  }
  const tiny = r.width < 2 && r.height < 2;
  const inView = inter > 4 || (tiny && r.top >= -20 && r.top <= vh && r.left >= -20 && r.left <= vw);
  return { inter, dist, painted, inView, area: Math.max(0, r.width * r.height) };
}

function rankCandidates(scored) {
  const seen = new Set();
  const list = [];
  for (const item of scored) {
    if (!item || !item.el || seen.has(item.el)) continue;
    seen.add(item.el);
    list.push(Object.assign({}, item, viewportRank(item.el)));
  }
  for (const item of list) item.fit = contextFit(item.el);
  list.sort((a, b) => {
    if (Math.abs((b.fit || 0) - (a.fit || 0)) > 8) return (b.fit || 0) - (a.fit || 0);
    if (a.inView !== b.inView) return a.inView ? -1 : 1;
    if (a.painted !== b.painted) return b.painted - a.painted;
    if (Math.abs((b.score || 0) - (a.score || 0)) > 10) return (b.score || 0) - (a.score || 0);
    if (a.inter !== b.inter) return b.inter - a.inter;
    return a.dist - b.dist;
  });
  return list;
}

function pickBestNav(scored) {
  return rankCandidates(scored)[0] || null;
}

const skipTried = new Map();
const lastHits = new Map();

function markTried(actionId, el) {
  if (!actionId || !el) return;
  if (!skipTried.has(actionId)) skipTried.set(actionId, new WeakSet());
  skipTried.get(actionId).add(el);
}

function wasTried(actionId, el) {
  const set = skipTried.get(actionId);
  return !!(set && el && set.has(el));
}

function clearTried(actionId) {
  if (actionId) skipTried.delete(actionId);
  else skipTried.clear();
}

function isVisible(el, { allowHiddenInPlayer = true, allowHiddenChrome = false } = {}) {
  if (!el || el.nodeType !== 1) return false;
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
  const style = window.getComputedStyle(el);
  if (!style || style.display === "none") return false;
  const rect = el.getBoundingClientRect();
  const tiny = rect.width < 2 && rect.height < 2;
  const hidden = style.visibility === "hidden" || Number(style.opacity) === 0;
  const hiddenOk =
    (allowHiddenInPlayer && isInPlayer(el)) || (allowHiddenChrome && isInAppChrome(el));
  if (tiny && hidden) return hiddenOk;
  if (hidden) return hiddenOk;
  if (tiny) {
    const host = el.closest("button, a, [role='button'], [role='link']");
    if (host && host !== el) return isVisible(host, { allowHiddenInPlayer, allowHiddenChrome });
    return hiddenOk || isInAppChrome(el);
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
  const raw = String(label || "").toLowerCase();
  return NEGATIVE.some((w) => {
    const nw = normalize(w);
    if (!nw) return false;
    if (/[\u4e00-\u9fff]/.test(w)) return n.includes(nw) || raw.includes(w);
    if (nw.length <= 6) {
      const re = new RegExp("(^|\\s)" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)", "i");
      return re.test(raw) || n === nw;
    }
    return n.includes(nw);
  });
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

function firePointerClick(target) {
  const rect = target.getBoundingClientRect ? target.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
  const x = rect.left + Math.max(1, rect.width / 2);
  const y = rect.top + Math.max(1, rect.height / 2);
  const common = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    button: 0,
    buttons: 1,
  };
  try {
    target.focus && target.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }
  target.dispatchEvent(new PointerEvent("pointerdown", { ...common, pointerId: 1, isPrimary: true }));
  target.dispatchEvent(new MouseEvent("mousedown", common));
  target.dispatchEvent(new PointerEvent("pointerup", { ...common, pointerId: 1, isPrimary: true, buttons: 0 }));
  target.dispatchEvent(new MouseEvent("mouseup", { ...common, buttons: 0 }));
  target.dispatchEvent(new MouseEvent("click", { ...common, buttons: 0 }));
  if (typeof target.click === "function") target.click();
}

function simulateClick(el) {
  if (!el || isOurHost(el)) return false;
  try {
    if (el.tagName === "LINK" && el.href) {
      window.location.href = el.href;
      return true;
    }
    const target = closestClickable(el);
    firePointerClick(el);
    if (target && target !== el) firePointerClick(target);
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

function isNonNavControl(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.tagName === "INPUT") {
    const t = String(el.type || "text").toLowerCase();
    if (!["button", "submit", "image"].includes(t)) return true;
  }
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.isContentEditable) return true;
  const role = String(el.getAttribute("role") || "").toLowerCase();
  if (role === "search" || role === "textbox" || role === "searchbox" || role === "combobox") return true;
  const label = getLabel(el);
  if (/搜索|查询|收藏|点赞|投币|关注|评论|search|favorite|favourite|\blike\b|collect|magnify/.test(label)) {
    return true;
  }
  if (el.closest && el.closest("[role='search'], .v-text-field, [class*='search' i]")) {
    if (/搜索|search|查询|magnify/.test(label) || role === "search" || el.tagName === "INPUT") return true;
  }
  return false;
}

function isNavListContext(el) {
  if (!el || !el.closest) return false;
  return !!el.closest(
    "nav, .pagination, .pager, [class*='paginat' i], [class*='page-nav' i], [class*='episode' i], [class*='playlist' i], [class*='page-list' i], [role='navigation']"
  );
}

function scoreCandidate(el, actionId) {
  if (!el || isOurHost(el)) return -Infinity;
  const nav = actionId === "nextPage" || actionId === "prevPage";
  if (nav && isNonNavControl(el)) return -Infinity;
  const strongCls =
    (actionId === "nextPage" && STRONG_NEXT_CLASS.test(`${el.className || ""} ${el.id || ""}`)) ||
    (actionId === "prevPage" && STRONG_PREV_CLASS.test(`${el.className || ""} ${el.id || ""}`));
  if (strongCls) {
    if (!isDisplayed(el)) return -Infinity;
  } else if (!isVisible(el, { allowHiddenChrome: nav })) {
    return -Infinity;
  }
  const label = getLabel(el);
  if (hasNegative(label)) return nav ? -Infinity : -20;

  let score = 0;
  const phrases = TEXT[actionId] || [];
  const hit = textMatches(label, phrases);
  score += hit;
  const compact = normalize(label);
  const onlyWeakNav = nav && hit > 0 && WEAK_NAV.has(compact);
  if (onlyWeakNav) {
    const inNav = isNavListContext(el);
    if (isMailHost() && !/封|邮件|郵件|mail|message/.test(compact)) score -= 40;
    else if (!inNav && !isInPlayer(el) && !isMailHost()) score -= 24;
  }

  const cls = `${el.className || ""} ${el.id || ""}`.toLowerCase();
  if (actionId === "nextPage" && STRONG_NEXT_CLASS.test(cls)) score += 36;
  else if (actionId === "nextPage" && /next|forward|后一|下一|nextmail/.test(cls)) score += 12;
  if (actionId === "prevPage" && STRONG_PREV_CLASS.test(cls)) score += 36;
  else if (actionId === "prevPage" && /prev|previous|back|前一|上一|prevmail/.test(cls)) score += 12;
  if (actionId === "playPause" && /play|pause|播放|暂停/.test(cls)) score += 12;

  const rel = (el.getAttribute("rel") || "").toLowerCase();
  if (actionId === "nextPage" && /\bnext\b/.test(rel)) score += 40;
  if (actionId === "prevPage" && /\bprev|previous\b/.test(rel)) score += 40;

  if (nav) {
    if (isNavListContext(el)) score += 16;
    if (isInPlayer(el) && /集|话|章|episode|chapter/.test(label)) score += 18;
    if (/封|邮件|郵件|mail|message|信件/.test(label)) {
      score += 18;
      if (isInAppChrome(el) || isMailHost()) score += 16;
    } else if (isInAppChrome(el) && hit <= 0 && !strongCls) {
      score -= 20;
    }
  }

  if (actionId.startsWith("seek") || actionId === "playPause") {
    if (isInPlayer(el)) score += 14;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width * rect.height > 4) score += 4;
  if (label.length > 0 && label.length <= 16) score += 6;

  return score;
}

function isMailHost() {
  return /mail\.|outlook\.|foxmail/.test(hostname());
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

function cssEscapeAttr(value) {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function phraseAttrSelectors(actionId) {
  const sels = [];
  for (const p of TEXT[actionId] || []) {
    if (!p || WEAK_NAV.has(normalize(p))) continue;
    const e = cssEscapeAttr(p);
    sels.push(`[title*="${e}" i]`);
    sels.push(`[aria-label*="${e}" i]`);
    sels.push(`[data-tooltip*="${e}" i]`);
    sels.push(`[data-title*="${e}" i]`);
  }
  return sels;
}

function clickablePool() {
  return queryAllDeep(
    "a, button, [role='button'], [role='link'], input, summary, [onclick], [tabindex], [title], [aria-label], [data-tooltip], .bpx-player-ctrl-btn, .ytp-button"
  );
}

const LEARN_KEY = "ur-learned";
const PENDING_TOAST_KEY = "ur-pending-toast";
UR.learned = {};

function loadLearned() {
  try {
    chrome.storage.local.get(LEARN_KEY, (data) => {
      UR.learned = (data && data[LEARN_KEY]) || {};
    });
  } catch {
    UR.learned = {};
  }
}
loadLearned();
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[LEARN_KEY]) {
      UR.learned = changes[LEARN_KEY].newValue || {};
    }
  });
} catch {
  /* ignore */
}

function uniqueSelector(el) {
  if (!el || el.nodeType !== 1) return "";
  if (el.id) {
    const idSel = "#" + cssEscapeAttr(el.id);
    try {
      if (document.querySelectorAll(idSel).length === 1) return idSel;
    } catch {
      /* ignore */
    }
  }
  const attrNames = ["data-cmd", "data-action", "data-tool", "data-type", "data-name", "name", "aria-label", "title"];
  for (const name of attrNames) {
    const value = el.getAttribute(name);
    if (!value || value.length > 48) continue;
    const sel = el.tagName.toLowerCase() + "[" + name + '="' + cssEscapeAttr(value) + '"]';
    try {
      if (document.querySelectorAll(sel).length === 1) return sel;
    } catch {
      /* ignore */
    }
  }
  const parts = [];
  let cur = el;
  for (let i = 0; i < 7 && cur && cur.nodeType === 1 && cur !== document.documentElement; i++) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      parts.unshift("#" + cssEscapeAttr(cur.id));
      break;
    }
    const parent = cur.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
      if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(cur) + 1) + ")";
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(">");
}

function pageKey() {
  try {
    let hash = (location.hash || "").split("?")[0];
    const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
    if (parts.length > 2) hash = "#" + parts.slice(0, 2).join("/");
    return hostname() + (location.pathname || "") + hash;
  } catch {
    return hostname();
  }
}

function findLearned(actionId) {
  const rec =
    (UR.learned[pageKey()] && UR.learned[pageKey()][actionId]) ||
    (UR.learned[hostname()] && UR.learned[hostname()][actionId]);
  if (!rec) return null;
  if (rec.css) {
    try {
      const found = queryAllDeep(rec.css);
      const visible = found.find((el) => isVisible(el, { allowHiddenChrome: true }));
      if (visible) return visible;
      if (found[0]) return found[0];
    } catch {
      /* ignore */
    }
  }
  if (rec.title) {
    const hit = queryAllDeep('[title="' + cssEscapeAttr(rec.title) + '"]')[0];
    if (hit) return hit;
  }
  if (rec.aria) {
    const hit = queryAllDeep('[aria-label="' + cssEscapeAttr(rec.aria) + '"]')[0];
    if (hit) return hit;
  }
  return null;
}

function persistLearned(pending) {
  try {
    const payload = { [LEARN_KEY]: UR.learned };
    if (pending) payload[PENDING_TOAST_KEY] = pending;
    chrome.storage.local.set(payload).catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    chrome.runtime.sendMessage({ type: "UR_SAVE_LEARNED", learned: UR.learned, pending: pending || null }, () => {
      try {
        void chrome.runtime.lastError;
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

function reportCapture(ok, text, actionId) {
  persistLearned({
    ts: Date.now(),
    text: String(text),
    kind: ok ? "ok" : "err",
    extra: { retry: actionId },
    actionId,
  });
}

function saveLearned(actionId, el) {
  if (!el || el.nodeType !== 1 || isOurHost(el)) return null;
  const rec = {
    css: uniqueSelector(el),
    tag: el.tagName,
    id: el.id || "",
    className: String(el.className || "").slice(0, 120),
    title: el.getAttribute("title") || "",
    aria: el.getAttribute("aria-label") || "",
    text: getOwnText(el).slice(0, 40),
    outer: String(el.outerHTML || "").slice(0, 600),
  };
  const keys = [pageKey(), hostname()].filter(Boolean);
  if (!keys.length) return null;
  for (const key of keys) {
    if (!UR.learned[key]) UR.learned[key] = {};
    UR.learned[key][actionId] = rec;
  }
  reportCapture(true, "指定成功：已记住这个按钮。跳转后仍可改指定。", actionId);
  clearTried(actionId);
  return rec;
}

function siteLearnKeys() {
  const host = hostname();
  const keys = Object.keys(UR.learned || {});
  if (host) {
    return keys.filter((k) => k === host || k.indexOf(host + "/") === 0 || k.indexOf(host + "#") === 0);
  }
  const pk = pageKey();
  return keys.filter((k) => k === pk);
}

UR.clearSiteLearned = function clearSiteLearned() {
  const keys = siteLearnKeys();
  for (const key of keys) delete UR.learned[key];
  persistLearned(null);
  return keys.length;
};

let captureHandler = null;
UR.startCapture = function startCapture(actionId) {
  if (captureHandler) {
    document.removeEventListener("click", captureHandler, true);
    captureHandler = null;
  }
  captureHandler = (event) => {
    if (isOurEvent(event) || isOurHost(event.target)) {
      reportCapture(false, "指定失败：不能指定遥控器自己的按钮，请点网页上的按钮。", actionId);
      return;
    }
    const el = closestClickable(event.target) || event.target;
    if (!el || el.nodeType !== 1 || isOurHost(el)) {
      reportCapture(false, "指定失败：没有点到可用的页面按钮。", actionId);
      return;
    }
    const rec = saveLearned(actionId, el);
    if (!rec) {
      reportCapture(false, "指定失败：无法记住这个按钮。", actionId);
      return;
    }
    document.removeEventListener("click", captureHandler, true);
    captureHandler = null;
  };
  document.addEventListener("click", captureHandler, true);
};

function strongNavSelectors(actionId) {
  if (actionId === "nextPage") {
    return [
      "a.btn-next",
      ".btn-next",
      "a.next-btn",
      ".next-btn",
      ".page-next",
      '[class*="btn-next"]',
      '[class*="btn_next"]',
      'img[src*="btn-next"]',
      'img[src*="next.png"]',
      'img[src*="next.svg"]',
      'img[src*="next.gif"]',
      'input[src*="next"]',
    ];
  }
  if (actionId === "prevPage") {
    return [
      "a.btn-prev",
      ".btn-prev",
      "a.prev-btn",
      ".prev-btn",
      ".page-prev",
      '[class*="btn-prev"]',
      '[class*="btn_prev"]',
      'img[src*="btn-prev"]',
      'img[src*="prev.png"]',
      'img[src*="prev.svg"]',
      'img[src*="btn-back"]',
      'input[src*="prev"]',
    ];
  }
  return [];
}

function findStrongNavButtons(actionId) {
  const found = [];
  for (const el of findBySelectors(strongNavSelectors(actionId))) {
    const target = closestClickable(el);
    if (!target || isOurHost(target)) continue;
    if (!isDisplayed(target) && !isDisplayed(el)) continue;
    found.push(target);
  }
  return found;
}

function findByVisibleText(actionId) {
  if (!document.body) return [];
  const phrases = (TEXT[actionId] || []).filter((p) => p.length >= 2 && !WEAK_NAV.has(normalize(p)));
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const t = (node.textContent || "").trim();
      if (!t || t.length > 24) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    const t = normalize(node.textContent);
    if (phrases.some((p) => t === normalize(p) || t.includes(normalize(p)))) {
      const el = node.parentElement;
      if (el && !isOurHost(el)) out.push(el);
    }
    node = walker.nextNode();
  }
  return out;
}

function findNativeButton(actionId) {
  const scored = [];
  const nav = actionId === "nextPage" || actionId === "prevPage";

  const pageItemBtn = findPageItemButton(actionId);
  if (pageItemBtn) scored.push({ el: pageItemBtn, score: 96, via: "page-item" });

  const learned = findLearned(actionId);
  if (learned) scored.push({ el: learned, score: 88, via: "learned" });

  if (nav) {
    for (const el of findStrongNavButtons(actionId)) {
      scored.push({ el, score: 72, via: "nav-class" });
    }
  }

  if (nav) {
    const rel = actionId === "nextPage" ? "next" : "prev";
    for (const el of queryAllDeep(`link[rel='${rel}'], link[rel='${rel === "prev" ? "previous" : "next"}']`)) {
      if (el.href) scored.push({ el, score: 45, via: "rel-link" });
    }
  }

  for (const el of findBySelectors(adapterSelectors(actionId))) {
    const s = el.tagName === "LINK" ? 44 : scoreCandidate(el, actionId);
    if (s > -10) scored.push({ el: closestClickable(el), score: s + 24, via: "adapter" });
  }

  if (nav) {
    for (const el of findBySelectors(phraseAttrSelectors(actionId))) {
      const s = scoreCandidate(el, actionId);
      if (s >= 20) scored.push({ el: closestClickable(el), score: Math.max(s, 36), via: "attr-text" });
    }
    for (const el of findByVisibleText(actionId)) {
      const s = scoreCandidate(el, actionId);
      if (s >= 20) scored.push({ el: closestClickable(el), score: Math.max(s, 40), via: "visible-text" });
    }
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
      if (s >= 28) scored.push({ el: closestClickable(el), score: s, via: "text" });
    }
  }

  if (nav) {
    const numbered = findNumberedPageLink(actionId === "nextPage" ? 1 : -1);
    if (numbered) scored.push({ el: numbered, score: 28, via: "page-number" });
    const adjacent = findAdjacentListItem(actionId === "nextPage" ? 1 : -1);
    if (adjacent) scored.push({ el: adjacent, score: 30, via: "list-adjacent" });
  }

  const ranked = rankCandidates(scored.filter((x) => x && x.el && x.score >= 28 && !isOurHost(x.el)));
  return ranked.find((x) => !wasTried(actionId, x.el) && !isOurHost(x.el)) || null;
}

function findAdjacentListItem(dir) {
  const selected = queryAllDeep(
    "[aria-current='page'], [aria-current='true'], nav [aria-selected='true'], .pagination .active, .pagination .current, .pager .active, .page-item.active"
  ).filter((el) => isVisible(el, { allowHiddenInPlayer: false }));

  for (const el of selected) {
    if (!isNavListContext(el) && !el.closest(".pagination, .pager, nav")) continue;
    const row =
      (el.closest &&
        el.closest("tr, li, [role='row'], [role='listitem'], [role='option'], .page-item")) ||
      el;
    const parent = row.parentElement;
    if (!parent) continue;
    const siblings = Array.from(parent.children).filter((c) => {
      if (c.nodeType !== 1) return false;
      if (c.tagName !== row.tagName) return false;
      return isVisible(c, { allowHiddenInPlayer: false });
    });
    if (siblings.length < 2) continue;
    const idx = siblings.indexOf(row);
    const next = siblings[idx + dir];
    if (!next) continue;
    const clickable =
      next.querySelector("a, [role='link'], [role='button']") || next;
    if (!clickable || isOurHost(clickable) || isNonNavControl(clickable)) continue;
    if (hasNegative(getLabel(clickable))) continue;
    return clickable;
  }
  return null;
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
  const before = media.currentTime || 0;
  const next = Math.min(dur, Math.max(0, before + delta));
  try {
    if (typeof media.fastSeek === "function") media.fastSeek(next);
    else media.currentTime = next;
  } catch {
    media.currentTime = next;
  }
  try {
    media.dispatchEvent(new Event("seeking", { bubbles: true }));
    media.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    media.dispatchEvent(new Event("seeked", { bubbles: true }));
  } catch {
    /* ignore */
  }
  return { ok: true, method: "media.currentTime", detail: next, from: before };
}

function applyRate(media, rate) {
  const n = Number(rate);
  if (!media || !Number.isFinite(n) || n <= 0) return { ok: false, reason: "bad-rate" };
  try {
    media.playbackRate = n;
  } catch {
    return { ok: false, reason: "rate-throw" };
  }
  return { ok: true, method: "media.rate", rate: media.playbackRate || n, exists: true, paused: !!(media.paused || media.ended) };
}

function applyPlayPause(media) {
  if (media.paused || media.ended) {
    const p = media.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
    return { ok: true, method: "media.play", paused: false, exists: true };
  }
  media.pause();
  return { ok: true, method: "media.pause", paused: true, exists: true };
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

function getActivePageItem() {
  const marked = queryAllDeep("section.page-item.page-active, .page-WH.page-item.page-active");
  if (marked.length) return marked[0];
  const items = queryAllDeep("section.page-item, .page-WH.page-item");
  return (
    items.find((el) => {
      try {
        const st = window.getComputedStyle(el);
        return st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) !== 0;
      } catch {
        return false;
      }
    }) || null
  );
}

function findPageItemButton(actionId) {
  const page = getActivePageItem();
  if (!page) return null;
  if (actionId === "nextPage") {
    return page.querySelector("a.btn-next, .btn-next, .btn-next2, .btn-next-end, .btn-ce, .btn-start, .btn-start1, .btn-start2");
  }
  if (actionId === "prevPage") {
    return page.querySelector("a.btn-prev, .btn-prev, .btn-prev-start, .btn-prev2");
  }
  return null;
}

function applyPageItemNav(dir) {
  const page = getActivePageItem();
  if (!page) return { ok: false, reason: "no-page-item" };
  let sib = dir > 0 ? page.nextElementSibling : page.previousElementSibling;
  while (sib && !(sib.classList && sib.classList.contains("page-item"))) {
    sib = dir > 0 ? sib.nextElementSibling : sib.previousElementSibling;
  }
  if (!sib) return { ok: false, reason: "no-sibling-page" };
  const parent = page.parentElement;
  if (parent) {
    for (const child of parent.children) {
      if (child.classList) child.classList.remove("page-active");
    }
  } else {
    page.classList.remove("page-active");
  }
  sib.classList.add("page-active");
  try {
    sib.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    /* ignore */
  }
  return { ok: true, method: "page-item-active" };
}

function hasCourseIframe() {
  return !!document.querySelector(
    'iframe.page-iframe, iframe[src*="mycourse.cn/course"], iframe[src*="mcwk.mycourse.cn"]'
  );
}

function pingCourseIframes(dir, force) {
  return new Promise((resolve) => {
    if (getActivePageItem()) {
      chrome.runtime.sendMessage({ type: "UR_CLICK_COURSE_BTN", dir, force: !!force }, (res) => {
        resolve(res && res.ok ? res : { ok: false, reason: (res && res.reason) || "click-failed" });
      });
      return;
    }
    if (window === window.top && !hasCourseIframe() && !document.querySelector("iframe")) {
      resolve({ ok: false, reason: "no-course-iframe" });
      return;
    }
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMsg);
      resolve(result);
    };
    const onMsg = (event) => {
      const data = event.data;
      if (!data || data.__ur !== 1 || data.type !== "UR_COURSE_NAV_OK") return;
      finish({ ok: true, method: data.method || "jquery-click" });
    };
    window.addEventListener("message", onMsg);
    const frames = document.querySelectorAll("iframe");
    for (const frame of frames) {
      try {
        frame.contentWindow.postMessage({ __ur: 1, type: "UR_COURSE_NAV", dir, force: !!force }, "*");
      } catch {
        /* ignore */
      }
    }
    window.setTimeout(() => finish({ ok: false, reason: "iframe-timeout" }), 600);
  });
}



const PAGE_PARAMS = ["page", "p", "pn", "pageno", "page_no", "pagenum", "page_num", "offset", "start"];

function forceNavigate(dir) {
  const pageItem = applyPageItemNav(dir);
  if (pageItem.ok) return pageItem;

  const adjacent = findAdjacentListItem(dir);
  if (adjacent && simulateClick(adjacent)) {
    return { ok: true, method: "list-adjacent" };
  }

  if (isMailHost()) {
    sendKey(dir > 0 ? "j" : "k", dir > 0 ? "KeyJ" : "KeyK", dir > 0 ? 74 : 75);
    sendKey(dir > 0 ? "n" : "p", dir > 0 ? "KeyN" : "KeyP", dir > 0 ? 78 : 80);
    return { ok: true, method: "mail-shortcut" };
  }

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

UR.tryNative = function tryNative(actionId, opts) {
  const meta = UR.ACTIONS[actionId];
  if (!meta) return { ok: false, reason: "unknown_action" };
  opts = opts || {};

  if (meta.group === "nav" && hasCourseIframe() && !getActivePageItem()) {
    return { ok: false, reason: "course-in-iframe" };
  }

  if (!opts.skipMedia && meta.group === "media") {
    const media = getPrimaryMedia();
    if (media) {
      if (actionId === "playPause") return applyPlayPause(media);
      if (typeof meta.delta === "number") return applySeek(media, meta.delta);
    }
  }

  const hit = findNativeButton(actionId);
  if (hit && simulateClick(hit.el)) {
    lastHits.set(actionId, hit.el);
    return { ok: true, method: "click", via: hit.via, score: hit.score };
  }

  return { ok: false, reason: opts.skipTried ? "no_more_candidates" : "not_found" };
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
    let count = hit ? 1 : 0;
    if (id === "nextPage" || id === "prevPage") {
      count = findStrongNavButtons(id).length || (hit ? 1 : 0);
    }
    out[id] = {
      button: !!(hit && hit.score >= 28),
      media: UR.ACTIONS[id].group === "media" && !!getPrimaryMedia(),
      count,
    };
  }
  return out;
};

UR.getMediaState = mediaState;

function reportFrame() {
  if (!extAlive() || globalThis.__urBootId !== UR_BOOT) return false;
  try {
    chrome.runtime.sendMessage(
      {
        type: "UR_FRAME_HELLO",
        href: location.href,
        hasPageItem: !!document.querySelector("section.page-item, .page-WH.page-item, .page-item"),
        hasActive: !!document.querySelector(".page-item.page-active"),
        iframes: Array.from(document.querySelectorAll("iframe")).map((f) => f.src || f.getAttribute("src") || ""),
      },
      () => {
        try {
          void chrome.runtime.lastError;
        } catch {
          /* invalidated */
        }
      }
    );
    return true;
  } catch {
    return false;
  }
}
reportFrame();
const helloTimer = setInterval(() => {
  if (!reportFrame()) clearInterval(helloTimer);
}, 2000);

try {
  let urPort = null;
  function attachPort(port) {
    port.onDisconnect.addListener(() => {
      try {
        void chrome.runtime.lastError;
      } catch {
        /* ignore */
      }
      if (urPort === port) urPort = null;
    });
    port.onMessage.addListener((msg) => {
      handlePortMessage(port, msg);
    });
  }
  function openPort() {
    if (!extAlive()) return;
    try {
      urPort = chrome.runtime.connect({ name: "ur-frame" });
      attachPort(urPort);
    } catch {
      urPort = null;
    }
  }
  function handlePortMessage(port, msg) {
    if (msg.type === "MEDIA") {
      let result = { ok: false, reason: "no-media", exists: false, paused: true, href: location.href };
      try {
        const media = getPrimaryMedia();
        if (msg.kind === "state") {
          result = media
            ? { ok: true, exists: true, paused: !!(media.paused || media.ended), href: location.href }
            : { ok: false, exists: false, paused: true, href: location.href };
        } else if (msg.kind === "rate") {
          result = media
            ? applyRate(media, Number(msg.delta) || Number(msg.rate) || 1)
            : { ok: false, reason: "no-media", href: location.href };
        } else if (media) {
          result =
            msg.kind === "playPause"
              ? applyPlayPause(media)
              : applySeek(media, Number(msg.delta) || 0);
        }
      } catch (err) {
        result = { ok: false, reason: String(err && err.message ? err.message : err) };
      }
      try {
        port.postMessage(Object.assign({ type: "MEDIA_RESULT" }, result));
      } catch {
        /* ignore */
      }
      return;
    }
    if (!msg || msg.type !== "NAV") return;
    let result = { ok: false, reason: "no-page-item", href: location.href };
    try {
      if (getActivePageItem()) {
        if (msg.force) {
          result = applyPageItemNav(msg.dir || 1);
        } else {
          const btn = findPageItemButton(msg.dir > 0 ? "nextPage" : "prevPage");
          if (btn) {
            try {
              btn.click();
            } catch {
              /* ignore */
            }
            result = { ok: true, method: "dom-click", href: location.href };
          } else {
            result = { ok: false, reason: "no-btn", href: location.href };
          }
        }
      }
    } catch (err) {
      result = { ok: false, reason: String(err && err.message ? err.message : err) };
    }
    try {
      port.postMessage(Object.assign({ type: "NAV_RESULT" }, result));
    } catch {
      /* ignore */
    }
  }
  openPort();
  window.addEventListener("pagehide", () => {
    if (!urPort) return;
    try {
      urPort.disconnect();
    } catch {
      /* ignore */
    }
    urPort = null;
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted || !urPort) openPort();
  });
} catch {
  /* ignore */
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "UR_FRAME_ACTION") return false;
  try {
    if (msg.action === "__capture") {
      UR.startCapture(msg.captureFor);
      sendResponse({ ok: true, method: "capturing" });
      return false;
    }
    if (msg.action === "forcePageItem" || msg.action === "clickPageItem") {
      if (msg.force || msg.action === "forcePageItem") {
        sendResponse(applyPageItemNav(msg.dir || 1));
      } else {
        sendResponse({ ok: false, reason: "use-main-click" });
      }
      return false;
    }
    const result = msg.force ? UR.force(msg.action) : UR.tryNative(msg.action, msg.opts || {});
    sendResponse(result);
  } catch (err) {
    sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) });
  }
  return false;
});

(() => {
  if (window !== window.top) return;

  const STORAGE_KEY = "ur-overlay-state";
  let host;
  let root;
  let shadow;
  let toastTimer = 0;
  let scanTimer = 0;
  let messagesBound = false;
  let bootPromise = null;
  let draggingOverlay = false;
  let dragW = 0;
  let dragH = 0;
  let lastKnownPaused = true;
  let actionLock = false;
  let toastConsuming = false;
  let advancedOpen = false;
  let autoTimer = 0;
  let autoRunning = false;
  let autoInterval = 1000;
  let currentRate = 1;
  const RATE_PRESETS = [0.5, 1, 2, 16];
  const INTERVAL_PRESETS = [
    { ms: 50, label: "50ms" },
    { ms: 500, label: "500ms" },
    { ms: 1000, label: "1s" },
    { ms: 10000, label: "10s" },
    { ms: 60000, label: "1min" },
  ];

  const existing = document.getElementById(UR.HOST_ID);
  if (existing && existing.shadowRoot && existing.shadowRoot.querySelector(".ur-root")) {
    host = existing;
    shadow = existing.shadowRoot;
    root = shadow.querySelector(".ur-root");
    bindMessages();
    bind();
    return;
  }
  if (existing) existing.remove();

  window.__universalRemoteBooting = true;
  bindMessages();
  boot();

  function bindMessages() {
    if (messagesBound) return;
    messagesBound = true;
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg) return false;
      if (msg.type === "UR_PING") {
        sendResponse({ ok: true, ready: !!root });
        return false;
      }
      if (msg.type === "UR_TOGGLE") {
        ensureVisible(true).then(() => sendResponse({ ok: !!root }));
        return true;
      }
      if (msg.type === "UR_SHOW") {
        ensureVisible(false).then(() => sendResponse({ ok: !!root }));
        return true;
      }
      return false;
    });
  }

  async function ensureVisible(toggle) {
    if (!root) {
      try {
        await boot();
      } catch {
        return;
      }
    }
    if (!root) return;
    if (toggle) root.classList.toggle("is-hidden");
    else root.classList.remove("is-hidden");
    if (!root.classList.contains("is-hidden")) root.classList.remove("is-min");
    attachHost();
    keepInView();
    saveState();
    refreshChrome();
  }

  async function boot() {
    if (root) return;
    if (bootPromise) return bootPromise;
    bootPromise = bootInner();
    try {
      await bootPromise;
    } catch (err) {
      bootPromise = null;
      throw err;
    }
  }

  async function bootInner() {
    if (root) return;
    let css = "";
    try {
      css = await fetch(chrome.runtime.getURL("content/overlay.css")).then((r) => r.text());
    } catch {
      css = "";
    }
    const saved = await loadState();
    mount(css, saved);
    bind();
    keepInView();
    refreshChrome();
    if (!scanTimer) {
      scanTimer = window.setInterval(() => {
        if (!extAlive() || globalThis.__urBootId !== UR_BOOT) {
          window.clearInterval(scanTimer);
          scanTimer = 0;
          return;
        }
        refreshChrome();
      }, 1600);
    }
    if (!root.dataset.urMediaBound) {
      root.dataset.urMediaBound = "1";
      const onMediaEvt = () => {
        const media = UR.getMediaState();
        if (media.exists) lastKnownPaused = media.paused;
        applyPlayIcon(!lastKnownPaused);
      };
      document.addEventListener("play", onMediaEvt, true);
      document.addEventListener("pause", onMediaEvt, true);
      document.addEventListener("ended", onMediaEvt, true);
    }
    window.addEventListener("beforeunload", () => {
      window.clearInterval(scanTimer);
      if (autoRunning) stopAutoNext();
    }, { once: true });
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (key === "className") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "htmlFor") node.htmlFor = value;
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? "" : String(value));
      }
    }
    if (children) {
      for (const child of children) {
        if (child == null) continue;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      }
    }
    return node;
  }

  function svgIcon(kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "currentColor");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      kind === "pause" ? "M4 3h3v10H4V3zm5 0h3v10H9V3z" : "M5 3.2v9.6L13 8 5 3.2z"
    );
    svg.appendChild(path);
    return svg;
  }

  function mediaButton(id, value, dir) {
    return el("button", { class: "ur-btn", "data-action": id, title: UR.ACTIONS[id].label }, [
      el("span", { class: "ur-dot" }),
      el("span", { class: "kicker", text: dir }),
      value,
    ]);
  }

  function mount(css, saved) {
    host = document.createElement("div");
    host.id = UR.HOST_ID;
    host.setAttribute("data-ur-host", "1");
    host.style.cssText =
      "all:initial !important;position:fixed !important;left:0 !important;top:0 !important;width:0 !important;height:0 !important;overflow:visible !important;z-index:2147483647 !important;pointer-events:none !important;display:block !important;";
    shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = css;
    const playIcon = el("span", { "data-play-icon": "1" }, [svgIcon("play")]);

    root = el("div", { class: "ur-root" }, [
      el("div", { class: "ur-toast", hidden: true }),
      el("section", { class: "ur-panel" }, [
        el("header", { class: "ur-head" }, [
          el("img", { class: "ur-logo", alt: "", src: chrome.runtime.getURL("icons/icon48.png") }),
          el("div", { class: "ur-title" }, [
            "万能遥控",
            el("span", { class: "ur-ver", text: "v" + UR.VERSION }),
          ]),
          el("div", { class: "ur-head-actions" }, [
            el("button", { class: "ur-icon-btn", "data-act": "min", title: "最小化", text: "–" }),
            el("button", { class: "ur-icon-btn", "data-act": "hide", title: "隐藏，可再点扩展图标显示", text: "×" }),
          ]),
        ]),
        el("div", { class: "ur-status", text: "正在识别当前页面…" }),
        el("div", { class: "ur-label", text: "播放" }),
        el("div", { class: "ur-row" }, [
          mediaButton("seekBack60", "1分", "快退"),
          mediaButton("seekBack10", "10秒", "快退"),
          el("button", { class: "ur-btn primary", "data-action": "playPause", title: "播放 / 暂停" }, [
            el("span", { class: "ur-dot" }),
            playIcon,
          ]),
          mediaButton("seekForward10", "10秒", "快进"),
          mediaButton("seekForward60", "1分", "快进"),
        ]),
        el("div", { class: "ur-label", text: "翻页" }),
        el("div", { class: "ur-row" }, [
          el("button", { class: "ur-btn wide", "data-action": "prevPage", title: "上一页 / 上一封 / 上一集" }, [
            el("span", { class: "ur-dot" }),
            "‹  上一页",
          ]),
          el("button", { class: "ur-btn wide", "data-action": "nextPage", title: "下一页 / 下一封 / 下一集" }, [
            el("span", { class: "ur-dot" }),
            "下一页  ›",
          ]),
        ]),
        el("button", { class: "ur-adv-toggle", "data-act": "advanced", type: "button" }, [
          el("span", { class: "ur-adv-caret", text: "▸" }),
          "高级",
        ]),
        el("div", { class: "ur-advanced", hidden: true }, [
          el("div", { class: "ur-label", text: "倍速" }),
          el(
            "div",
            { class: "ur-chips", "data-rate-chips": "1" },
            RATE_PRESETS.map((n) =>
              el("button", { class: "ur-chip" + (n === 1 ? " is-on" : ""), "data-rate": String(n), type: "button", text: n + "×" })
            )
          ),
          el("div", { class: "ur-label", text: "自动下一页" }),
          el(
            "div",
            { class: "ur-chips", "data-interval-chips": "1" },
            INTERVAL_PRESETS.map((p) =>
              el("button", {
                class: "ur-chip" + (p.ms === 1000 ? " is-on" : ""),
                "data-interval": String(p.ms),
                type: "button",
                text: p.label,
              })
            )
          ),
          el("div", { class: "ur-adv-custom" }, [
            el("span", { text: "自定义" }),
            el("input", {
              class: "ur-interval-input",
              type: "number",
              min: "10",
              max: "600000",
              step: "1",
              value: "1000",
              title: "10–600000 毫秒",
            }),
            el("span", { text: "ms" }),
            el("button", { class: "ur-auto-btn", "data-act": "auto-next", type: "button", text: "开始" }),
          ]),
          // --- CSS anim feature start (delete with content/css-anim.js) ---
          el("div", { class: "ur-css-anim" }, [
            el("div", { class: "ur-label", text: "CSS 动画（试验）" }),
            el(
              "div",
              { class: "ur-chips", "data-anim-rate-chips": "1" },
              [0.5, 1, 2, 16].map((n) =>
                el("button", {
                  class: "ur-chip" + (n === 1 ? " is-on" : ""),
                  "data-anim-rate": String(n),
                  type: "button",
                  text: n + "×",
                })
              )
            ),
            el("button", {
              class: "ur-chip",
              "data-act": "css-anim-skip",
              type: "button",
              title: "把视口内正在播放的有限次 CSS 动画跳到结束",
              text: "跳过当前动画",
            }),
          ]),
          // --- CSS anim feature end ---
          el("div", { class: "ur-label", text: "指定按钮" }),
          el("div", { class: "ur-chips" }, [
            el("button", { class: "ur-chip", "data-capture": "prevPage", type: "button", text: "指定上一页" }),
            el("button", { class: "ur-chip", "data-capture": "nextPage", type: "button", text: "指定下一页" }),
            el("button", { class: "ur-chip", "data-capture": "playPause", type: "button", text: "指定播放" }),
            el("button", { class: "ur-chip danger", "data-act": "clear-learned", type: "button", text: "删除本网站所有指定" }),
          ]),
        ]),
        el("div", { class: "ur-legend" }, [
          el("span", {}, [el("i", { class: "g" }), "识别到按钮"]),
          el("span", {}, [el("i", { class: "b" }), "可控制播放器"]),
        ]),
      ]),
      el("button", { class: "ur-min", type: "button", title: "展开遥控器" }, [
        el("img", { alt: "", src: chrome.runtime.getURL("icons/icon48.png") }),
        "遥控",
      ]),
    ]);

    if (saved.hidden) root.classList.add("is-hidden");
    if (saved.minimized) root.classList.add("is-min");
    if (typeof saved.left === "number" && typeof saved.top === "number") {
      root.style.left = saved.left + "px";
      root.style.top = saved.top + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
    }

    shadow.appendChild(style);
    shadow.appendChild(root);
    if (saved.advancedOpen) setAdvanced(true, false);
    if (Number.isFinite(Number(saved.autoInterval))) setAutoInterval(Number(saved.autoInterval), false);
    if (Number.isFinite(Number(saved.playbackRate)) && Number(saved.playbackRate) > 0) {
      currentRate = Number(saved.playbackRate);
      syncRateChips();
    }
    const intervalInput = shadow.querySelector(".ur-interval-input");
    if (intervalInput) {
      intervalInput.addEventListener("change", onCustomInterval);
      intervalInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") onCustomInterval(ev);
      });
    }
    attachHost();
    watchHost();
    watchFullscreen();
    consumePendingToast();
  }

  function attachHost() {
    if (!host) return;
    const fs = document.fullscreenElement;
    const parent = fs || document.body || document.documentElement;
    if (!parent) return;
    if (host.parentNode !== parent) parent.appendChild(host);
  }

  function watchHost() {
    const mo = new MutationObserver(() => {
      if (host && !host.isConnected) attachHost();
    });
    if (document.documentElement) {
      mo.observe(document.documentElement, { childList: true });
    }
    if (document.body) {
      mo.observe(document.body, { childList: true });
    }
    window.setInterval(() => {
      if (!extAlive() || globalThis.__urBootId !== UR_BOOT) return;
      if (host && !host.isConnected) attachHost();
    }, 2500);
  }

  function watchFullscreen() {
    document.addEventListener("fullscreenchange", () => {
      attachHost();
      keepInView();
    });
  }

  function bind() {
    root.addEventListener("click", onClick);
    shadow.querySelector(".ur-min").addEventListener("click", () => {
      root.classList.remove("is-min");
      saveState();
      consumePendingToast();
    });
    enableDrag(shadow.querySelector(".ur-head"));
    enableDrag(shadow.querySelector(".ur-min"));
    window.addEventListener("resize", keepInView);
    window.addEventListener("pageshow", () => consumePendingToast());
  }

  function onClick(event) {
    const btn = event.target.closest("[data-act], [data-action], [data-force], [data-capture], [data-copy], [data-retry], [data-rate], [data-interval], [data-anim-rate]");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if (btn.dataset.act === "min") {
      root.classList.add("is-min");
      hideToast();
      saveState();
      return;
    }
    if (btn.dataset.act === "hide") {
      hidePanel();
      return;
    }
    if (btn.dataset.act === "advanced") {
      setAdvanced(!advancedOpen, true);
      return;
    }
    if (btn.dataset.act === "auto-next") {
      if (autoRunning) stopAutoNext("已停止自动下一页");
      else startAutoNext();
      return;
    }
    if (btn.dataset.act === "css-anim-skip") {
      runCssAnim("skip");
      return;
    }
    if (btn.dataset.animRate) {
      runCssAnim("rate", Number(btn.dataset.animRate));
      return;
    }
    if (btn.dataset.act === "clear-learned") {
      const n = UR.clearSiteLearned();
      showToast(n ? "已删除本网站的全部指定按钮。" : "本网站还没有指定过按钮。", "ok");
      refreshChrome();
      return;
    }
    if (btn.dataset.rate) {
      setPlaybackRate(Number(btn.dataset.rate));
      return;
    }
    if (btn.dataset.interval) {
      setAutoInterval(Number(btn.dataset.interval), true);
      return;
    }
    if (btn.dataset.retry) {
      tryOther(btn.dataset.retry);
      return;
    }
    if (btn.dataset.copy != null) {
      const text = shadow.querySelector(".ur-toast-text");
      const value = text ? text.textContent : "";
      if (value) {
        navigator.clipboard.writeText(value).then(
          () => {
            btn.textContent = "已复制";
          },
          () => {
            const range = document.createRange();
            range.selectNodeContents(text);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        );
      }
      return;
    }
    if (btn.dataset.capture) {
      beginCapture(btn.dataset.capture);
      return;
    }
    if (btn.dataset.force) {
      runAction(btn.dataset.force, true);
      return;
    }
    if (btn.dataset.action) runAction(btn.dataset.action, false);
  }

  async function runAction(actionId, force) {
    const meta = UR.ACTIONS[actionId];
    if (!meta || actionLock) return;
    actionLock = true;
    try {
      showToast("正在尝试「" + meta.label + "」…", "info", { busy: true });

      let result;
      if (force) {
        result = await execute(actionId, true);
        if (result.ok) {
          showToast(`已强制执行：${meta.label}。已绕过页面原逻辑，站点状态可能与显示不一致。使用强制跳过存在风险，请谨慎核对结果。`, "ok", {
            retry: actionId,
          });
        } else {
          showToast(`强制执行失败：${result.reason || "not_found"}${result.detail ? " " + result.detail : ""}`, "err");
        }
        if (actionId === "playPause") rememberPlayState(result, true);
        refreshChrome();
        return;
      }

      result = await execute(actionId, false);
      if (result.ok) {
        const method = String(result.method || "");
        const how = method.indexOf("jquery-click") === 0 || method.indexOf("dom-click") === 0
          ? "已点击页面按钮（走页面原逻辑）"
          : method.indexOf("page-item") === 0
          ? "已强制切换页面（可能已跳过站点原逻辑）"
          : method.indexOf("main-") === 0 || method === "media.currentTime" || method === "media.rate"
            ? "已" + meta.label
            : result.method === "click"
              ? `已点击页面按钮：${meta.label}`
              : `已通过播放器执行：${meta.label}`;
        showToast(how + "\n若点错了，可尝试其它候选，或改为指定正确按钮。", "ok", { retry: actionId });
        if (actionId === "playPause") rememberPlayState(result, true);
        refreshChrome();
        return;
      }

      showToast(
        `未找到「${meta.label}」对应按钮。连点遥控不会强制。\n\n使用强制跳过可能存在风险，请谨慎使用。强制执行会绕过页面原来的点击与校验流程，站点状态或数据可能与预期不符。`,
        "warn",
        { force: actionId, retry: actionId }
      );
    } finally {
      actionLock = false;
    }
  }

  async function beginCapture(actionId) {
    UR.startCapture(actionId);
    try {
      await chrome.runtime.sendMessage({
        type: "UR_BROADCAST",
        payload: { action: "__capture", captureFor: actionId },
      });
    } catch {
      /* ignore */
    }
    const label = UR.ACTIONS[actionId] ? UR.ACTIONS[actionId].label : actionId;
    showToast("请点网页上当前这一屏的「" + label + "」按钮。点一次就记住，这次会正常跳转。", "warn");
  }

  async function tryOther(actionId) {
    if (actionLock) return;
    actionLock = true;
    try {
      const label = UR.ACTIONS[actionId] ? UR.ACTIONS[actionId].label : actionId;
      showToast("正在尝试其它「" + label + "」候选…", "info", { busy: true });
      const prev = lastHits.get(actionId);
      if (prev) markTried(actionId, prev);
      const result = await execute(actionId, false, { skipMedia: true, skipSpecial: true, skipTried: true });
      if (result && result.ok) {
        showToast("已改点另一个候选。若仍不对，可继续尝试或改为指定正确按钮。", "ok", { retry: actionId });
        if (actionId === "playPause") rememberPlayState(result, true);
      } else {
        showToast("没有其它可点的候选按钮了。可改为指定页面上的正确按钮。", "warn", { force: actionId });
      }
      refreshChrome();
    } finally {
      actionLock = false;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[LEARN_KEY]) refreshChrome();
    if (changes[PENDING_TOAST_KEY] && changes[PENDING_TOAST_KEY].newValue) {
      consumePendingToast();
    }
  });

  async function execute(actionId, force, opts) {
    const meta = UR.ACTIONS[actionId];
    opts = opts || {};
    if (meta && meta.group === "media" && !opts.skipMedia) {
      try {
        const media = await chrome.runtime.sendMessage({
          type: "UR_MEDIA",
          kind: actionId === "playPause" ? "playPause" : "seek",
          delta: meta.delta || 0,
        });
        if (media && media.ok) return media;
      } catch {
        /* fall through */
      }
    }
    if (meta && meta.group === "nav" && !opts.skipSpecial) {
      try {
        const posted = await pingCourseIframes(meta.dir, force);
        if (posted && posted.ok) return posted;
      } catch {
        /* fall through */
      }
      try {
        const pageItem = await chrome.runtime.sendMessage({
          type: "UR_PAGE_ITEM",
          dir: meta.dir,
          force: !!force,
        });
        if (pageItem && pageItem.ok) return pageItem;
        if (force && pageItem) return pageItem;
      } catch {
        /* fall through */
      }
    }
    const local = force ? UR.force(actionId) : UR.tryNative(actionId, opts);
    if (local && local.ok) return local;
    try {
      const remote = await chrome.runtime.sendMessage({
        type: "UR_BROADCAST",
        payload: { action: actionId, force, opts },
      });
      if (remote && remote.ok) return remote;
      return remote || local || { ok: false, reason: "not_found" };
    } catch {
      return local || { ok: false, reason: "not_found" };
    }
  }

  function hideToast() {
    const box = shadow && shadow.querySelector(".ur-toast");
    if (box) box.hidden = true;
    window.clearTimeout(toastTimer);
  }

  function showToast(text, kind, extra) {
    if (!shadow || !root || root.classList.contains("is-min") || root.classList.contains("is-hidden")) return;
    const box = shadow.querySelector(".ur-toast");
    if (!box) return;
    box.className = "ur-toast " + (kind || "");
    box.hidden = false;
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(el("div", { class: "ur-toast-text", text: String(text) }));
    const opts = extra && typeof extra === "object" ? extra : extra ? { force: extra } : {};
    const forceAction = opts.force;
    const retryAction = opts.retry;
    const actions = [];
    if (kind === "err" || (text && String(text).length > 40)) {
      actions.push(el("button", { class: "ur-toast-learn", "data-copy": "1", text: "复制" }));
    }
    if (retryAction) {
      actions.push(el("button", { class: "ur-toast-alt", "data-retry": retryAction, text: "尝试其他可能按键" }));
      actions.push(el("button", { class: "ur-toast-learn", "data-capture": retryAction, text: "改为指定某按键" }));
    }
    if (forceAction) {
      if (!retryAction) {
        actions.push(el("button", { class: "ur-toast-learn", "data-capture": forceAction, text: "手动指定" }));
      }
      actions.push(el("button", { class: "ur-toast-force", "data-force": forceAction, text: "强制执行（有风险）" }));
    }
    if (actions.length) box.appendChild(el("div", { class: "ur-toast-actions" }, actions));
    window.clearTimeout(toastTimer);
    if (opts.busy) return;
    toastTimer = window.setTimeout(() => {
      box.hidden = true;
    }, kind === "err" ? 20000 : forceAction || retryAction ? UR.CONFIRM_MS : 2600);
  }

  async function consumePendingToast() {
    if (toastConsuming) return;
    if (!shadow || !root || root.classList.contains("is-min") || root.classList.contains("is-hidden")) return;
    toastConsuming = true;
    try {
      let pending = null;
      try {
        const data = await chrome.storage.local.get(PENDING_TOAST_KEY);
        pending = data && data[PENDING_TOAST_KEY];
      } catch {
        return;
      }
      if (!pending || !pending.text) return;
      try {
        chrome.storage.local.remove(PENDING_TOAST_KEY);
      } catch {
        /* ignore */
      }
      if (pending.ts && Date.now() - pending.ts > 120000) return;
      showToast(pending.text, pending.kind || "ok", pending.extra || { retry: pending.actionId });
    } finally {
      toastConsuming = false;
    }
  }

  function rememberPlayState(result, toggleIfUnknown) {
    if (result && typeof result.paused === "boolean") {
      lastKnownPaused = result.paused;
    } else if (result && result.method === "media.play" || result && result.method === "main-play") {
      lastKnownPaused = false;
    } else if (result && (result.method === "media.pause" || result.method === "main-pause")) {
      lastKnownPaused = true;
    } else if (toggleIfUnknown) {
      lastKnownPaused = !lastKnownPaused;
    }
    applyPlayIcon(!lastKnownPaused);
  }

  function applyPlayIcon(playing) {
    if (!shadow) return;
    const icon = shadow.querySelector("[data-play-icon]");
    if (icon) {
      while (icon.firstChild) icon.removeChild(icon.firstChild);
      icon.appendChild(svgIcon(playing ? "pause" : "play"));
    }
    const btn = shadow.querySelector('[data-action="playPause"]');
    if (btn) {
      btn.classList.toggle("is-playing", !!playing);
      btn.title = playing ? "暂停" : "播放";
    }
  }

  async function refreshChrome() {
    if (!root || draggingOverlay || root.classList.contains("is-hidden")) return;
    let avail = {};
    try {
      avail = UR.scanAvailability();
    } catch {
      avail = {};
    }
    for (const btn of shadow.querySelectorAll("[data-action]")) {
      const info = avail[btn.dataset.action] || {};
      btn.classList.toggle("has-button", !!info.button);
      btn.classList.toggle("has-media", !!info.media);
    }
    const media = UR.getMediaState();
    let playing = media.exists ? !media.paused : !lastKnownPaused;
    if (media.exists) lastKnownPaused = media.paused;
    try {
      const remote = await chrome.runtime.sendMessage({ type: "UR_MEDIA_STATE" });
      if (remote && remote.exists) {
        lastKnownPaused = !!remote.paused;
        playing = !remote.paused;
      }
    } catch {
      /* ignore */
    }
    applyPlayIcon(playing);

    const found = [];
    if (avail.playPause && avail.playPause.button) found.push("播放按钮");
    else if (media.exists || playing || !lastKnownPaused) found.push("播放器");
    if (avail.prevPage && avail.prevPage.button) {
      found.push(avail.prevPage.count > 1 ? "上一页×" + avail.prevPage.count + "（按当前位置选）" : "上一页/封");
    }
    if (avail.nextPage && avail.nextPage.button) {
      found.push(avail.nextPage.count > 1 ? "下一页×" + avail.nextPage.count + "（按当前位置选）" : "下一页/封");
    }
    try {
      const probe = await chrome.runtime.sendMessage({ type: "UR_HAS_PAGE_ITEM" });
      if (probe && probe.ok) {
        if (!found.some((s) => s.indexOf("下一页") === 0)) found.push("特化翻页");
      }
    } catch {
      /* ignore */
    }
    const status = shadow.querySelector(".ur-status");
    if (autoRunning) {
      status.textContent = "自动下一页中 · 每 " + formatInterval(autoInterval);
    } else {
      status.textContent = found.length
        ? "已识别：" + found.join(" · ")
        : "未识别到页面按钮，操作可能需要确认后强制执行";
    }
  }

  function enableDrag(handle) {
    if (!handle) return;
    let sx = 0;
    let sy = 0;
    let sl = 0;
    let st = 0;
    let nx = 0;
    let ny = 0;
    let raf = 0;

    const flush = () => {
      raf = 0;
      if (!root) return;
      const maxX = Math.max(8, window.innerWidth - dragW - 8);
      const maxY = Math.max(8, window.innerHeight - dragH - 8);
      const x = Math.min(maxX, Math.max(8, nx));
      const y = Math.min(maxY, Math.max(8, ny));
      root.style.transform = "translate(" + (x - sl) + "px," + (y - st) + "px)";
    };

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const innerBtn = event.target.closest && event.target.closest("button");
      if (innerBtn && innerBtn !== handle) return;
      draggingOverlay = true;
      const rect = root.getBoundingClientRect();
      sx = event.clientX;
      sy = event.clientY;
      sl = rect.left;
      st = rect.top;
      nx = sl;
      ny = st;
      dragW = rect.width;
      dragH = rect.height;
      root.classList.add("is-drag");
      root.style.left = sl + "px";
      root.style.top = st + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.style.willChange = "transform";
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!draggingOverlay) return;
      nx = sl + (event.clientX - sx);
      ny = st + (event.clientY - sy);
      if (!raf) raf = window.requestAnimationFrame(flush);
    });

    const endDrag = () => {
      if (!draggingOverlay) return;
      draggingOverlay = false;
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      const maxX = Math.max(8, window.innerWidth - dragW - 8);
      const maxY = Math.max(8, window.innerHeight - dragH - 8);
      const x = Math.min(maxX, Math.max(8, nx));
      const y = Math.min(maxY, Math.max(8, ny));
      root.style.transform = "";
      root.style.willChange = "";
      root.style.left = x + "px";
      root.style.top = y + "px";
      root.classList.remove("is-drag");
      saveState();
    };

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function place(left, top) {
    const rect = root.getBoundingClientRect();
    const maxX = Math.max(8, window.innerWidth - rect.width - 8);
    const maxY = Math.max(8, window.innerHeight - rect.height - 8);
    const x = Math.min(maxX, Math.max(8, left));
    const y = Math.min(maxY, Math.max(8, top));
    root.style.left = x + "px";
    root.style.top = y + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
  }

  function keepInView() {
    if (!root || draggingOverlay) return;
    const rect = root.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    place(rect.left, rect.top);
  }

  function hidePanel() {
    if (autoRunning) stopAutoNext();
    root.classList.add("is-hidden");
    saveState();
  }

  function setAdvanced(open, persist) {
    advancedOpen = !!open;
    const box = shadow && shadow.querySelector(".ur-advanced");
    const toggle = shadow && shadow.querySelector(".ur-adv-toggle");
    if (box) box.hidden = !advancedOpen;
    if (toggle) {
      toggle.classList.toggle("is-open", advancedOpen);
      const caret = toggle.querySelector(".ur-adv-caret");
      if (caret) caret.textContent = advancedOpen ? "▾" : "▸";
    }
    if (root) root.classList.toggle("is-advanced", advancedOpen);
    if (persist) {
      saveState();
      keepInView();
    }
  }

  function clampInterval(ms) {
    const n = Math.round(Number(ms));
    if (!Number.isFinite(n)) return 1000;
    return Math.min(600000, Math.max(10, n));
  }

  function setAutoInterval(ms, persist) {
    autoInterval = clampInterval(ms);
    const input = shadow && shadow.querySelector(".ur-interval-input");
    if (input && document.activeElement !== input) input.value = String(autoInterval);
    if (shadow) {
      for (const chip of shadow.querySelectorAll("[data-interval]")) {
        chip.classList.toggle("is-on", Number(chip.dataset.interval) === autoInterval);
      }
    }
    if (persist) saveState();
  }

  function onCustomInterval(event) {
    const input = event.target;
    const next = clampInterval(input.value);
    input.value = String(next);
    setAutoInterval(next, true);
  }

  function syncRateChips() {
    if (!shadow) return;
    for (const chip of shadow.querySelectorAll("[data-rate]")) {
      chip.classList.toggle("is-on", Number(chip.dataset.rate) === currentRate);
    }
  }

  // --- CSS anim feature start (delete with content/css-anim.js) ---
  function syncAnimRateChips(rate) {
    if (!shadow) return;
    for (const chip of shadow.querySelectorAll("[data-anim-rate]")) {
      chip.classList.toggle("is-on", Number(chip.dataset.animRate) === Number(rate));
    }
  }

  async function runCssAnim(kind, rate) {
    showToast(kind === "skip" ? "正在跳过 CSS 动画…" : "正在设置 CSS 动画速度…", "info", { busy: true });
    try {
      const res = await chrome.runtime.sendMessage({ type: "UR_CSS_ANIM", kind, rate });
      if (kind === "rate") syncAnimRateChips(rate);
      if (res && res.ok) {
        showToast(
          kind === "skip"
            ? "已跳过 " + res.count + " 段视口内的 CSS 动画。"
            : "已将 " + res.count + " 段 CSS 动画设为 " + rate + "×。",
          "ok"
        );
      } else {
        showToast("没有找到可控制的 CSS 动画（脚本/画布动画不在此功能范围内）。", "warn");
      }
    } catch {
      showToast("CSS 动画操作失败。", "err");
    }
  }
  // --- CSS anim feature end ---

  async function setPlaybackRate(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return;
    currentRate = n;
    syncRateChips();
    saveState();
    try {
      const remote = await chrome.runtime.sendMessage({ type: "UR_MEDIA", kind: "rate", rate: n });
      if (remote && remote.ok) {
        showToast("已将播放速度设为 " + n + "×", "ok");
        return;
      }
    } catch {
      /* fall through */
    }
    const media = UR.getMediaState && getPrimaryMedia();
    const local = media ? applyRate(media, n) : { ok: false };
    if (local.ok) showToast("已将播放速度设为 " + n + "×", "ok");
    else showToast("未找到可调速的播放器。", "warn");
  }

  function formatInterval(ms) {
    if (ms >= 60000 && ms % 60000 === 0) return ms / 60000 + "min";
    if (ms >= 1000 && ms % 1000 === 0) return ms / 1000 + "s";
    return ms + "ms";
  }

  function updateAutoBtn() {
    const btn = shadow && shadow.querySelector('[data-act="auto-next"]');
    if (btn) {
      btn.textContent = autoRunning ? "停止" : "开始";
      btn.classList.toggle("is-on", autoRunning);
    }
    const status = shadow && shadow.querySelector(".ur-status");
    if (status && autoRunning) {
      status.textContent = "自动下一页中 · 每 " + formatInterval(autoInterval);
    }
  }

  function stopAutoNext(msg) {
    autoRunning = false;
    if (autoTimer) {
      window.clearTimeout(autoTimer);
      autoTimer = 0;
    }
    updateAutoBtn();
    if (msg) showToast(msg, "ok");
  }

  function startAutoNext() {
    stopAutoNext();
    autoRunning = true;
    updateAutoBtn();
    const tick = async () => {
      if (!autoRunning || !extAlive() || globalThis.__urBootId !== UR_BOOT) {
        stopAutoNext();
        return;
      }
      const result = await execute("nextPage", false);
      if (!autoRunning) return;
      if (!result || !result.ok) {
        stopAutoNext();
        showToast("自动下一页已停止：未找到可点的按钮。", "warn", { force: "nextPage", retry: "nextPage" });
        return;
      }
      updateAutoBtn();
      autoTimer = window.setTimeout(tick, autoInterval);
    };
    tick();
  }

  async function loadState() {
    if (!extAlive()) return {};
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return data[STORAGE_KEY] || {};
    } catch {
      return {};
    }
  }

  function saveState() {
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const state = {
      left: Number.isFinite(rect.left) ? rect.left : 24,
      top: Number.isFinite(rect.top) ? rect.top : 24,
      minimized: root.classList.contains("is-min"),
      hidden: root.classList.contains("is-hidden"),
      advancedOpen: advancedOpen,
      autoInterval: autoInterval,
      playbackRate: currentRate,
    };
    if (!extAlive()) return;
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: state }).catch(() => {});
    } catch {
      /* extension reloaded */
    }
  }
})();
})();

