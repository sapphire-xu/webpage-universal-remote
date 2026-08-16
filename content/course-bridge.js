"use strict";

(function () {
  if (window.__urCourseBridge) return;
  window.__urCourseBridge = true;

  function findActive() {
    var marked = document.querySelector("section.page-item.page-active, .page-WH.page-item.page-active");
    if (marked) return marked;
    var items = document.querySelectorAll("section.page-item, .page-WH.page-item");
    for (var i = 0; i < items.length; i++) {
      try {
        var st = window.getComputedStyle(items[i]);
        if (st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) !== 0) {
          return items[i];
        }
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  function pickBtn(page, dir) {
    var sel =
      dir > 0
        ? "a.btn-next, .btn-next, .btn-next2, .btn-next-end, .btn-ce, a.btn-start, .btn-start, .btn-start1, .btn-start2"
        : "a.btn-prev, .btn-prev, .btn-prev-start, .btn-prev2";
    var nodes = page.querySelectorAll(sel);
    if (!nodes.length) return null;
    for (var i = 0; i < nodes.length; i++) {
      try {
        var st = window.getComputedStyle(nodes[i]);
        var r = nodes[i].getBoundingClientRect();
        if (st.display !== "none" && st.visibility !== "hidden" && r.width > 1 && r.height > 1) {
          return nodes[i];
        }
      } catch (e) {
        /* ignore */
      }
    }
    return nodes[0];
  }

  function guardAudio() {
    var audio = document.getElementById("click-base");
    if (!audio || typeof audio.play !== "function") return function () {};
    var orig = audio.play.bind(audio);
    audio.play = function () {
      try {
        var p = orig();
        if (p && typeof p.catch === "function") p.catch(function () {});
        return p;
      } catch (e) {
        return Promise.resolve();
      }
    };
    return function () {
      audio.play = orig;
    };
  }

  function clickNav(dir) {
    var page = findActive();
    if (!page) return { ok: false, reason: "no-page-item", href: location.href };
    var btn = pickBtn(page, dir);
    if (!btn) return { ok: false, reason: "no-btn", href: location.href };

    var restore = guardAudio();
    var before = page;
    try {
      if (window.jQuery) {
        window.jQuery(btn).trigger("click");
      } else {
        btn.click();
      }
    } catch (e) {
      try {
        btn.click();
      } catch (e2) {
        restore();
        return { ok: false, reason: String(e2 && e2.message ? e2.message : e2), href: location.href };
      }
    }
    restore();

    var after = findActive();
    if (after && after !== before) {
      return {
        ok: true,
        method: window.jQuery ? "jquery-click" : "dom-click",
        from: before.className,
        to: after.className,
        href: location.href,
      };
    }

    try {
      btn.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, view: window, button: 0 }
        )
      );
    } catch (e) {
      /* ignore */
    }
    after = findActive();
    if (after && after !== before) {
      return { ok: true, method: "mouse-click", from: before.className, to: after.className, href: location.href };
    }
    return { ok: false, reason: "click-no-change", href: location.href, cls: String(btn.className || "") };
  }

  function moveActive(page, dir) {
    var sib = dir > 0 ? page.nextElementSibling : page.previousElementSibling;
    while (sib && !(sib.classList && sib.classList.contains("page-item"))) {
      sib = dir > 0 ? sib.nextElementSibling : sib.previousElementSibling;
    }
    if (!sib) return { ok: false, reason: "no-sibling-page", href: location.href };
    var parent = page.parentElement;
    if (parent) {
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i].classList) parent.children[i].classList.remove("page-active");
      }
    } else {
      page.classList.remove("page-active");
    }
    sib.classList.add("page-active");
    return { ok: true, method: "page-item-active", from: page.className, to: sib.className, href: location.href };
  }

  function handleNav(dir, force) {
    var clicked = clickNav(dir);
    if (clicked.ok) return clicked;
    if (force) {
      var page = findActive();
      if (page) return moveActive(page, dir);
    }
    return clicked;
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.__ur !== 1 || data.type !== "UR_COURSE_NAV") return;
    var result = handleNav(data.dir || 1, !!data.force);
    if (result.ok && event.source) {
      try {
        event.source.postMessage(
          { __ur: 1, type: "UR_COURSE_NAV_OK", method: result.method, from: result.from, to: result.to },
          "*"
        );
      } catch (e) {
        /* ignore */
      }
    }
  });

  document.addEventListener("ur-course-nav", function (event) {
    var dir = event && event.detail && event.detail.dir ? event.detail.dir : 1;
    clickNav(dir);
  });
})();
