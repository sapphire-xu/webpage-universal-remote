"use strict";

/**
 * 试验功能：CSS / Web Animations 加速与跳过。
 * 删除本功能时：
 *  1. 删本文件
 *  2. 从 manifest.json 的 content_scripts 去掉 css-anim.js
 *  3. 删 background.js 里「CSS anim feature」整段
 *  4. 删 content.js / overlay.css 里「CSS anim feature」整段
 */

(() => {
  const HOST_ID = "universal-remote-host";

  function isOurEl(el) {
    if (!el) return false;
    if (el.id === HOST_ID) return true;
    try {
      if (el.closest && el.closest("#" + HOST_ID)) return true;
    } catch {
      /* ignore */
    }
    try {
      const root = el.getRootNode && el.getRootNode();
      if (root && root.host && root.host.id === HOST_ID) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function inView(el) {
    if (!el || !el.getBoundingClientRect) return true;
    try {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
    } catch {
      return true;
    }
  }

  function addAnims(owner, out, seen) {
    if (!owner || !owner.getAnimations) return;
    let list = [];
    try {
      list = owner.getAnimations();
    } catch {
      return;
    }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a || seen.has(a)) continue;
      const el = a.effect && a.effect.target;
      if (isOurEl(el)) continue;
      seen.add(a);
      out.push(a);
    }
  }

  function collectAnims() {
    const out = [];
    const seen = new Set();
    addAnims(document, out, seen);
    const walk = (root) => {
      if (!root || !root.querySelectorAll) return;
      let all = [];
      try {
        all = Array.from(root.querySelectorAll("*"));
      } catch {
        all = [];
      }
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (isOurEl(el) || el.id === HOST_ID) continue;
        if (el.shadowRoot) {
          addAnims(el.shadowRoot, out, seen);
          walk(el.shadowRoot);
        }
      }
    };
    walk(document);
    return out;
  }

  function isActive(anim) {
    const st = anim.playState;
    return st === "running" || st === "paused";
  }

  function isFiniteAnim(anim) {
    try {
      const t = anim.effect && anim.effect.getComputedTiming && anim.effect.getComputedTiming();
      if (!t) return true;
      if (t.iterations === Infinity) return false;
      return true;
    } catch {
      return true;
    }
  }

  function applyRate(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, count: 0, reason: "bad-rate" };
    const anims = collectAnims();
    let count = 0;
    for (let i = 0; i < anims.length; i++) {
      const a = anims[i];
      if (!isActive(a)) continue;
      try {
        a.playbackRate = n;
        count += 1;
      } catch {
        /* ignore */
      }
    }
    return { ok: count > 0, count, kind: "rate", rate: n };
  }

  function applySkip() {
    const anims = collectAnims();
    let count = 0;
    for (let i = 0; i < anims.length; i++) {
      const a = anims[i];
      if (!isActive(a) || !isFiniteAnim(a)) continue;
      const el = a.effect && a.effect.target;
      if (el && !inView(el)) continue;
      try {
        a.finish();
        count += 1;
      } catch {
        try {
          const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming();
          if (t && Number.isFinite(t.endTime)) a.currentTime = t.endTime;
          else if (t && Number.isFinite(t.duration)) a.currentTime = t.duration;
          count += 1;
        } catch {
          /* ignore */
        }
      }
    }
    return { ok: count > 0, count, kind: "skip" };
  }

  let watchTimer = 0;
  let watchKind = "rate";
  let watchRate = 1;

  function tick() {
    if (watchKind === "skip") return applySkip();
    return applyRate(watchRate);
  }

  function startWatch(kind, rate) {
    watchKind = kind === "skip" ? "skip" : "rate";
    const n = Number(rate);
    if (Number.isFinite(n) && n > 0) watchRate = n;
    if (!watchTimer) {
      watchTimer = setInterval(tick, 100);
    }
    return tick();
  }

  function stopWatch() {
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = 0;
    }
    return { ok: true, count: 0, kind: "unwatch" };
  }

  function handle(kind, rate) {
    if (kind === "unwatch") return stopWatch();
    if (watchTimer) {
      watchKind = kind === "skip" ? "skip" : "rate";
      const n = Number(rate);
      if (Number.isFinite(n) && n > 0) watchRate = n;
    }
    if (kind === "skip") return applySkip();
    return applyRate(rate);
  }

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || msg.type !== "UR_CSS_ANIM") return false;
      try {
        if (msg.kind === "watch") {
          sendResponse(startWatch(msg.apply || "rate", msg.rate));
        } else {
          sendResponse(handle(msg.kind, msg.rate));
        }
      } catch (err) {
        sendResponse({ ok: false, count: 0, reason: String(err && err.message ? err.message : err) });
      }
      return false;
    });
  } catch {
    /* ignore */
  }

  window.addEventListener("pagehide", () => stopWatch());
})();
