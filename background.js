"use strict";

const frameBook = new Map();

function rememberFrame(tabId, frameId, info) {
  if (tabId == null || frameId == null) return;
  if (!frameBook.has(tabId)) frameBook.set(tabId, new Map());
  frameBook.get(tabId).set(frameId, Object.assign({ ts: Date.now() }, info || {}));
}

function framesForTab(tabId) {
  const map = frameBook.get(tabId);
  return map ? Array.from(map.entries()).map(([frameId, info]) => ({ frameId, ...info })) : [];
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return /^(chrome|edge|about|devtools|data|view-source|microsoft-edge):/i.test(url)
    || /chromewebstore\.google\.com/i.test(url)
    || /microsoftedge\.microsoft\.com\/addons/i.test(url);
}

async function injectTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content/content.js"],
    });
    return true;
  } catch {
    return false;
  }
}

async function sendToTop(tabId, type) {
  return chrome.tabs.sendMessage(tabId, { type }, { frameId: 0 });
}

async function showOnTab(tab) {
  if (!tab || tab.id == null) return;
  chrome.action.setBadgeText({ tabId: tab.id, text: "" });

  if (isRestrictedUrl(tab.url)) {
    markUnavailable(tab.id, "系统页 / 商店 / 内置页无法注入遥控器");
    return;
  }

  try {
    const res = await sendToTop(tab.id, "UR_SHOW");
    if (res && res.ok) return;
  } catch {
    /* 旧标签页可能还没注入 */
  }

  const injected = await injectTab(tab.id);
  if (injected) {
    try {
      await sendToTop(tab.id, "UR_SHOW");
      return;
    } catch {
      /* fall through */
    }
  }

  markUnavailable(tab.id, "这个页面不允许扩展注入（系统页、PDF、IE 模式或尚未刷新）");
}

function markUnavailable(tabId, title) {
  chrome.action.setBadgeText({ tabId, text: "!" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#c0392b" });
  chrome.action.setTitle({ tabId, title });
}

chrome.action.onClicked.addListener((tab) => {
  showOnTab(tab);
});

function onAnyFrameNav(details) {
  if (!details || details.tabId == null || details.frameId == null) return;
  const url = details.url || "";
  rememberFrame(details.tabId, details.frameId, {
    href: url,
    hasPageItem: /mycourse\.cn\/course\/|mcwk\./i.test(url),
    from: "nav",
  });
  if (details.frameId !== 0 && /mycourse\.cn/i.test(url)) {
    chrome.scripting
      .executeScript({
        target: { tabId: details.tabId, frameIds: [details.frameId] },
        world: "MAIN",
        files: ["content/course-bridge.js"],
      })
      .catch(() => {});
    chrome.scripting
      .executeScript({
        target: { tabId: details.tabId, frameIds: [details.frameId] },
        files: ["content/content.js"],
      })
      .catch(() => {});
  }
}

try {
  chrome.webNavigation.onCommitted.addListener(onAnyFrameNav);
  chrome.webNavigation.onDOMContentLoaded.addListener(onAnyFrameNav);
  chrome.webNavigation.onCompleted.addListener(onAnyFrameNav);
} catch {
  /* ignore */
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id != null && !isRestrictedUrl(tab.url)) injectTab(tab.id);
    }
  });
});

function courseNavInPage(dir, force) {
  function findActive() {
    const marked = document.querySelector("section.page-item.page-active, .page-WH.page-item.page-active");
    if (marked) return marked;
    const items = document.querySelectorAll("section.page-item, .page-WH.page-item");
    for (let i = 0; i < items.length; i++) {
      const st = window.getComputedStyle(items[i]);
      if (st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) !== 0) {
        return items[i];
      }
    }
    return items[0] || null;
  }

  function moveActive(page, nextDir) {
    let sib = nextDir > 0 ? page.nextElementSibling : page.previousElementSibling;
    while (sib && !(sib.classList && sib.classList.contains("page-item"))) {
      sib = nextDir > 0 ? sib.nextElementSibling : sib.previousElementSibling;
    }
    if (!sib) return { ok: false, reason: "no-sibling-page", href: location.href };
    const parent = page.parentElement;
    if (parent) {
      for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i].classList) parent.children[i].classList.remove("page-active");
      }
    } else {
      page.classList.remove("page-active");
    }
    sib.classList.add("page-active");
    return { ok: true, method: "page-item-active", from: page.className, to: sib.className, href: location.href };
  }

  const page = findActive();
  if (!page) return { ok: false, reason: "no-page-item", href: location.href };

  const sel =
    dir > 0
      ? "a.btn-next, .btn-next, .btn-next2, .btn-next-end, .btn-ce, a.btn-start, .btn-start, .btn-start1, .btn-start2"
      : "a.btn-prev, .btn-prev, .btn-prev-start, .btn-prev2";
  const nodes = page.querySelectorAll(sel);
  const btn = nodes[0] || null;

  if (btn) {
    const audio = document.getElementById("click-base");
    let origPlay = null;
    if (audio && typeof audio.play === "function") {
      origPlay = audio.play.bind(audio);
      audio.play = function () {
        try {
          const p = origPlay();
          if (p && typeof p.catch === "function") p.catch(function () {});
          return p;
        } catch (e) {
          return Promise.resolve();
        }
      };
    }
    try {
      if (window.jQuery) window.jQuery(btn).trigger("click");
      else btn.click();
    } catch (e) {
      try {
        btn.click();
      } catch (e2) {
        /* ignore */
      }
    }
    if (audio && origPlay) audio.play = origPlay;
    const after = findActive();
    if (after && after !== page) {
      return { ok: true, method: window.jQuery ? "jquery-click" : "dom-click", href: location.href };
    }
  }

  if (force) return moveActive(page, dir);
  return { ok: false, reason: btn ? "click-no-change" : "no-btn", href: location.href };
}

function mediaControlInPage(kind, delta) {
  function walkMedia(root, out) {
    if (!root) return;
    let list = [];
    try {
      list = root.querySelectorAll ? root.querySelectorAll("video, audio") : [];
    } catch (e) {
      list = [];
    }
    for (let i = 0; i < list.length; i++) out.push(list[i]);
    let all = [];
    try {
      all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    } catch (e) {
      all = [];
    }
    for (let i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) walkMedia(all[i].shadowRoot, out);
    }
  }

  function scoreMedia(m) {
    const r = m.getBoundingClientRect();
    const area = Math.max(0, (r.width || m.videoWidth || 0) * (r.height || m.videoHeight || 0));
    const playing = !m.paused && !m.ended;
    const ready = m.readyState > 0 || m.currentTime > 0;
    const inView = r.bottom > 0 && r.right > 0 && r.top < (window.innerHeight || 1) && r.left < (window.innerWidth || 1);
    let s = area;
    if (playing) s += 1e9;
    if (ready) s += 1e6;
    if (inView) s += 1e5;
    if (m.muted && area < 40000) s -= 1e5;
    return s;
  }

  function pickMedia() {
    const all = [];
    walkMedia(document, all);
    if (!all.length) return null;
    all.sort(function (a, b) {
      return scoreMedia(b) - scoreMedia(a);
    });
    return all[0] || null;
  }

  function applySeek(media, d) {
    const dur = Number.isFinite(media.duration) ? media.duration : Number.POSITIVE_INFINITY;
    const before = media.currentTime || 0;
    const next = Math.min(dur, Math.max(0, before + d));
    try {
      if (typeof media.fastSeek === "function") media.fastSeek(next);
      else media.currentTime = next;
    } catch (e) {
      try {
        media.currentTime = next;
      } catch (e2) {
        return { ok: false, reason: "seek-throw" };
      }
    }
    try {
      media.dispatchEvent(new Event("seeking", { bubbles: true }));
      media.dispatchEvent(new Event("timeupdate", { bubbles: true }));
      media.dispatchEvent(new Event("seeked", { bubbles: true }));
    } catch (e) {
      /* ignore */
    }

    const root =
      media.closest &&
      media.closest(".xgplayer, .dplayer, .jwplayer, .plyr, .bpx-player, #movie_player, .video-js");
    const player = root && (root.player || root.__player || root.xgplayer);
    if (player && typeof player.seek === "function") {
      try {
        player.seek(next);
      } catch (e) {
        /* ignore */
      }
    }
    const yt = document.getElementById("movie_player");
    if (yt && typeof yt.seekTo === "function") {
      try {
        yt.seekTo(next, true);
      } catch (e) {
        /* ignore */
      }
    }
    return { ok: true, method: "main-seek", from: before, to: next, href: location.href };
  }

  function applyPlayPause(media) {
    if (media.paused || media.ended) {
      const p = media.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
      return { ok: true, method: "main-play", paused: false, exists: true, href: location.href };
    }
    media.pause();
    return { ok: true, method: "main-pause", paused: true, exists: true, href: location.href };
  }

  const media = pickMedia();
  if (kind === "state") {
    if (!media) return { ok: false, exists: false, paused: true, href: location.href };
    return { ok: true, exists: true, paused: !!(media.paused || media.ended), href: location.href };
  }
  if (kind === "rate") {
    if (!media) return { ok: false, reason: "no-media", href: location.href };
    const rate = Number(delta);
    if (!Number.isFinite(rate) || rate <= 0) return { ok: false, reason: "bad-rate" };
    try {
      media.playbackRate = rate;
    } catch (e) {
      return { ok: false, reason: "rate-throw" };
    }
    const root =
      media.closest &&
      media.closest(".xgplayer, .dplayer, .jwplayer, .plyr, .bpx-player, #movie_player, .video-js");
    const player = root && (root.player || root.__player || root.xgplayer);
    if (player) {
      try {
        if (typeof player.playbackRate === "function") player.playbackRate(rate);
        else player.playbackRate = rate;
      } catch (e) {
        /* ignore */
      }
    }
    const yt = document.getElementById("movie_player");
    if (yt && typeof yt.setPlaybackRate === "function") {
      try {
        yt.setPlaybackRate(rate);
      } catch (e) {
        /* ignore */
      }
    }
    return {
      ok: true,
      method: "main-rate",
      rate: media.playbackRate || rate,
      exists: true,
      paused: !!(media.paused || media.ended),
      href: location.href,
    };
  }
  if (!media) return { ok: false, reason: "no-media", href: location.href };
  if (kind === "playPause") return applyPlayPause(media);
  return applySeek(media, Number(delta) || 0);
}

function pageItemProbe() {
  const items = document.querySelectorAll("section.page-item, .page-WH.page-item");
  const active = document.querySelector("section.page-item.page-active, .page-WH.page-item.page-active");
  return { ok: items.length > 0, count: items.length, active: !!active };
}

function isCourseFrame(url) {
  return /mcwk\.mycourse\.cn|mycourse\.cn\/course\//i.test(url || "");
}

const framePorts = new Set();
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ur-frame") return;
  framePorts.add(port);
  port.onDisconnect.addListener(() => {
    try {
      void chrome.runtime.lastError;
    } catch {
      /* ignore */
    }
    framePorts.delete(port);
  });
});

function mediaViaPorts(kind, delta) {
  return new Promise((resolve) => {
    const ports = Array.from(framePorts);
    if (!ports.length) {
      resolve({ ok: false, reason: "no-ports" });
      return;
    }
    let left = ports.length;
    let hit = null;
    const finish = () => {
      if (left < 0) return;
      left = -1;
      resolve(hit || { ok: false, reason: "ports-miss", detail: "n=" + ports.length });
    };
    for (const port of ports) {
      const onMsg = (msg) => {
        if (!msg || msg.type !== "MEDIA_RESULT") return;
        try {
          port.onMessage.removeListener(onMsg);
        } catch {
          /* ignore */
        }
        if (kind === "state") {
          if (msg.exists) {
            if (!msg.paused) hit = msg;
            else if (!hit || !hit.exists) hit = msg;
          }
        } else if (msg.ok && !hit) {
          hit = msg;
        }
        left -= 1;
        if (left <= 0) finish();
      };
      port.onMessage.addListener(onMsg);
      try {
        port.postMessage({ type: "MEDIA", kind, delta: delta });
        void chrome.runtime.lastError;
      } catch {
        left -= 1;
      }
    }
    setTimeout(finish, 700);
  });
}

function navViaPorts(dir, force) {
  return new Promise((resolve) => {
    const ports = Array.from(framePorts);
    if (!ports.length) {
      resolve({ ok: false, reason: "no-ports" });
      return;
    }
    let left = ports.length;
    let hit = null;
    const finish = () => {
      if (left < 0) return;
      left = -1;
      resolve(hit || { ok: false, reason: "ports-miss", detail: "n=" + ports.length });
    };
    for (const port of ports) {
      const onMsg = (msg) => {
        if (!msg || msg.type !== "NAV_RESULT") return;
        try {
          port.onMessage.removeListener(onMsg);
        } catch {
          /* ignore */
        }
        if (msg.ok && !hit) hit = msg;
        left -= 1;
        if (left <= 0) finish();
      };
      port.onMessage.addListener(onMsg);
      try {
        port.postMessage({ type: "NAV", dir, force });
        void chrome.runtime.lastError;
      } catch {
        left -= 1;
      }
    }
    setTimeout(finish, 900);
  });
}

async function listFrameIds(tabId) {
  const ids = new Set();
  try {
    const frames = (await chrome.webNavigation.getAllFrames({ tabId })) || [];
    for (const f of frames) ids.add(f.frameId);
  } catch {
    /* ignore */
  }
  for (const item of framesForTab(tabId)) ids.add(item.frameId);
  if (!ids.size) ids.add(0);
  return Array.from(ids);
}

async function injectCourseBridge(tabId) {
  let frames = [];
  try {
    frames = (await chrome.webNavigation.getAllFrames({ tabId })) || [];
  } catch {
    frames = [];
  }
  for (const frame of frames) {
    if (!/^https?:/i.test(frame.url || "")) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frame.frameId] },
        world: "MAIN",
        files: ["content/course-bridge.js"],
      });
    } catch {
      /* ignore */
    }
  }
}

async function runInAllFrames(tabId, func, args) {
  let frames = [];
  try {
    frames = (await chrome.webNavigation.getAllFrames({ tabId })) || [];
  } catch {
    frames = [];
  }

  const httpFrames = frames.filter((f) => /^https?:/i.test(f.url || ""));
  const preferred = httpFrames.filter((f) => isCourseFrame(f.url));
  const queue = preferred.length ? preferred.concat(httpFrames.filter((f) => !isCourseFrame(f.url))) : httpFrames;

  if (!queue.length) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        world: "MAIN",
        func,
        args: args || [],
      });
      return (results || []).map((r) => r && r.result).filter(Boolean);
    } catch {
      return [];
    }
  }

  const out = [];
  for (const frame of queue) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frame.frameId] },
        world: "MAIN",
        func,
        args: args || [],
      });
      const val = results && results[0] && results[0].result;
      if (val) out.push(val);
    } catch {
      /* captcha / opaque frames */
    }
  }
  return out;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !sender.tab || sender.tab.id == null) return;

  if (msg.type === "UR_SAVE_LEARNED") {
    chrome.storage.local
      .set({
        "ur-learned": msg.learned || {},
        "ur-pending-toast": msg.pending || null,
      })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "UR_BROADCAST") {
    relayToFrames(sender.tab.id, sender.frameId ?? 0, msg.payload)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, reason: "relay_failed" }));
    return true;
  }

  if (msg.type === "UR_FRAME_HELLO") {
    rememberFrame(sender.tab.id, sender.frameId ?? 0, {
      href: msg.href || sender.url || "",
      hasPageItem: !!msg.hasPageItem,
      hasActive: !!msg.hasActive,
      iframes: msg.iframes || [],
    });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "UR_PAGE_ITEM") {
    const tabId = sender.tab.id;
    const dir = msg.dir || 1;
    const force = !!msg.force;
    (async () => {
      const viaPort = await navViaPorts(dir, force);
      if (viaPort && viaPort.ok) return viaPort;

      const frameIds = await listFrameIds(tabId);
      const known = framesForTab(tabId);
      const parentIframes = known.flatMap((f) => f.iframes || []).filter(Boolean);
      const courseIds = [];
      for (const f of known) {
        if (f.hasPageItem || isCourseFrame(f.href)) courseIds.push(f.frameId);
      }
      try {
        const listed = (await chrome.webNavigation.getAllFrames({ tabId })) || [];
        for (const f of listed) {
          if (isCourseFrame(f.url)) courseIds.push(f.frameId);
        }
      } catch {
        /* ignore */
      }
      const uniqueCourse = Array.from(new Set(courseIds));
      const order = uniqueCourse.length ? uniqueCourse : frameIds;

      let lastFail = "";
      for (const frameId of order) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId, frameIds: [frameId] },
              world: "MAIN",
              files: ["content/course-bridge.js"],
            });
          } catch (e) {
            lastFail = "inject:" + (e && e.message ? e.message : e);
          }
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId, frameIds: [frameId] },
              world: "MAIN",
              func: courseNavInPage,
              args: [dir, force],
            });
            const val = results && results[0] && results[0].result;
            if (val && val.ok) return val;
            if (val && val.reason) lastFail = val.reason + "@" + (val.href || frameId);
          } catch (e) {
            lastFail = "exec:" + (e && e.message ? e.message : e);
          }
          try {
            const isolated = await chrome.tabs.sendMessage(
              tabId,
              { type: "UR_FRAME_ACTION", action: force ? "forcePageItem" : "clickPageItem", dir, force },
              { frameId }
            );
            if (isolated && isolated.ok) return isolated;
          } catch {
            /* ignore */
          }
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      const hrefs = known.map((f) => (f.href || "").slice(0, 80)).join("|");
      return {
        ok: false,
        reason: "not_found",
        detail:
          "frames=" +
          frameIds.length +
          ",hello=" +
          known.length +
          ",course=" +
          uniqueCourse.length +
          ",iframes=" +
          (parentIframes[0] || "-") +
          ",last=" +
          (lastFail || "-") +
          ",hrefs=" +
          hrefs,
      };
    })()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, reason: "page_item_failed" }));
    return true;
  }

  if (msg.type === "UR_CLICK_COURSE_BTN") {
    const frameId = sender.frameId;
    const tabId = sender.tab.id;
    const dir = msg.dir || 1;
    const force = !!msg.force;
    const target = frameId == null ? { tabId } : { tabId, frameIds: [frameId] };
    chrome.scripting
      .executeScript({
        target,
        world: "MAIN",
        func: courseNavInPage,
        args: [dir, force],
      })
      .then((results) => sendResponse((results && results[0] && results[0].result) || { ok: false, reason: "click-failed" }))
      .catch(() => sendResponse({ ok: false, reason: "click-failed" }));
    return true;
  }

  if (msg.type === "UR_MEDIA") {
    const tabId = sender.tab.id;
    const kind = msg.kind || "seek";
    const delta = kind === "rate" ? Number(msg.rate) : msg.delta || 0;
    (async () => {
      const viaPort = await mediaViaPorts(kind, delta);
      if (viaPort && viaPort.ok) return viaPort;
      const frameIds = await listFrameIds(tabId);
      for (const frameId of frameIds) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            world: "MAIN",
            func: mediaControlInPage,
            args: [kind, delta],
          });
          const val = results && results[0] && results[0].result;
          if (val && val.ok) return val;
        } catch {
          /* host blocked */
        }
      }
      return { ok: false, reason: "no-media" };
    })()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, reason: "media_failed" }));
    return true;
  }

  if (msg.type === "UR_MEDIA_STATE") {
    const tabId = sender.tab.id;
    (async () => {
      const viaPort = await mediaViaPorts("state", 0);
      if (viaPort && viaPort.exists) return viaPort;
      const frameIds = await listFrameIds(tabId);
      for (const frameId of frameIds) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId, frameIds: [frameId] },
            world: "MAIN",
            func: mediaControlInPage,
            args: ["state", 0],
          });
          const val = results && results[0] && results[0].result;
          if (val && val.exists) return val;
        } catch {
          /* host blocked */
        }
      }
      return { ok: false, exists: false, paused: true };
    })()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, exists: false, paused: true }));
    return true;
  }

  if (msg.type === "UR_HAS_PAGE_ITEM") {
    runInAllFrames(sender.tab.id, pageItemProbe, [])
      .then((results) => {
        const hit = results.find((r) => r && r.ok);
        sendResponse(hit || { ok: false, count: 0 });
      })
      .catch(() => sendResponse({ ok: false, count: 0 }));
    return true;
  }

  return false;
});

async function relayToFrames(tabId, sourceFrameId, payload) {
  let frames = [];
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId });
  } catch {
    frames = [];
  }

  if (!frames.length) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "UR_FRAME_ACTION", ...payload });
    } catch {
      return { ok: false, reason: "no_frame" };
    }
  }

  const results = await Promise.all(
    frames.map(async (frame) => {
      if (frame.frameId === sourceFrameId) return null;
      try {
        return await chrome.tabs.sendMessage(
          tabId,
          { type: "UR_FRAME_ACTION", ...payload },
          { frameId: frame.frameId }
        );
      } catch {
        return null;
      }
    })
  );

  const hit = results.find((r) => r && r.ok);
  if (hit) return hit;

  const firstFail = results.find((r) => r && r.reason);
  return firstFail || { ok: false, reason: "not_found" };
}
