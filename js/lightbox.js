/* ==========================================================================
   LIGHTBOX — shared full-screen viewer with keyboard navigation
   ========================================================================== */
(function () {
  "use strict";

  var root, imgEl, altEl, countEl, prevBtn, nextBtn, closeBtn;
  var items = [];
  var index = 0;
  var lastFocus = null;
  var ready = false;

  function cache() {
    root = document.getElementById("lightbox");
    if (!root) return false;
    imgEl = document.getElementById("lbImg");
    altEl = document.getElementById("lbAlt");
    countEl = document.getElementById("lbCount");
    prevBtn = document.getElementById("lbPrev");
    nextBtn = document.getElementById("lbNext");
    closeBtn = document.getElementById("lbClose");
    bind();
    return true;
  }

  function bind() {
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () { step(-1); });
    nextBtn.addEventListener("click", function () { step(1); });

    root.addEventListener("click", function (e) {
      if (e.target === root) close();
    });

    document.addEventListener("keydown", function (e) {
      if (root.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "Tab") trapFocus(e);
    });

    /* touch swipe */
    var startX = null;
    root.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    root.addEventListener("pointerup", function (e) {
      if (startX == null) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
      startX = null;
    });
  }

  function trapFocus(e) {
    var focusables = [closeBtn, prevBtn, nextBtn];
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function paint() {
    var it = items[index];
    if (!it) return;

    /* fade-swap */
    imgEl.style.opacity = "0";
    var pre = new Image();
    pre.onload = pre.onerror = function () {
      imgEl.src = it.src;
      imgEl.alt = it.alt || "";
      requestAnimationFrame(function () { imgEl.style.opacity = "1"; });
    };
    pre.src = it.src;

    altEl.textContent = it.alt || "";
    countEl.textContent =
      String(index + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");

    var single = items.length < 2;
    prevBtn.hidden = single;
    nextBtn.hidden = single;
  }

  function step(dir) {
    if (items.length < 2) return;
    index = (index + dir + items.length) % items.length;
    paint();
  }

  function open(list, startIndex) {
    if (!ready && !cache()) return;
    items = list || [];
    index = Math.max(0, Math.min(startIndex || 0, items.length - 1));
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add("no-scroll");
    requestAnimationFrame(function () {
      root.classList.add("lightbox--open");
      paint();
      closeBtn.focus({ preventScroll: true });
    });
  }

  function close() {
    if (!ready && !cache()) return;
    root.classList.remove("lightbox--open");
    document.body.classList.remove("no-scroll");
    setTimeout(function () {
      root.hidden = true;
      imgEl.src = "";
    }, 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  window.Lightbox = { open: open, close: close };

  /* preload neighbours for snappy navigation */
  document.addEventListener("DOMContentLoaded", function () {
    if (!cache()) return;
    ready = true;
    imgEl.style.transition = "opacity .35s ease";
  });
})();
