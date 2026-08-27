/* ==========================================================================
   CMS — applies admin-edited text & media, and gives a logged-in admin
   INLINE editing powers across the landing page AND story pages:
     • click any text        → edit in place (saved on blur / Enter)
     • click any photo/video → pick a new file, it uploads and swaps live
     • floating toolbar      → toggle edit mode, open dashboard, logout
   Visitors get none of this — the page only checks the session once and
   stays completely normal for them.

   Slot keys:
     static   : data-cms attributes in the HTML (hero, about, contact…)
     rendered : service.{n}.title|desc, stories.{n}.title|couple|location|date|excerpt,
                testi.{n}.quote|names|location          (landing, DOM order)
     story    : story.{slug}.title|couple|location|date|excerpt|desc1|desc2
                story.{slug}.cover|img1|img2|img3       (landing + story page)
   ========================================================================== */
(function () {
  "use strict";

  /* sync XHR on purpose: it must run before the user sees the page so
     edited text/media never flashes the wrong content */
  var data = null;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/site/content", false);
    xhr.send(null);
    if (xhr.status === 200) data = JSON.parse(xhr.responseText);
  } catch (e) {
    return; /* static preview — keep defaults */
  }
  if (!data) return;

  var text = data.text || {};
  var media = data.media || {};

  function setImg(img, url) {
    if (!img) return;
    img.src = url;
    img.removeAttribute("srcset");
  }

  /* tag an element as editable + apply its DB override (if any) */
  function tagText(el, key, isHtml) {
    if (!el || el.hasAttribute("data-cms")) return;
    el.setAttribute("data-cms", key);
    if (isHtml) el.setAttribute("data-cms-html", "");
    if (text[key]) {
      if (isHtml) el.innerHTML = text[key];
      else el.textContent = text[key];
    }
  }
  function tagMedia(el, slot) {
    if (!el || el.hasAttribute("data-cms-slot")) return;
    el.setAttribute("data-cms-slot", slot);
    var ov = media[slot];
    if (ov && ov.url) {
      if (slot === "cta_bg") el.style.backgroundImage = "url('" + ov.url + "')";
      else setImg(el, ov.url);
    }
  }

  /* ---------------- static [data-cms] elements ---------------- */
  document.querySelectorAll("[data-cms]").forEach(function (el) {
    var key = el.getAttribute("data-cms");
    if (text[key]) {
      if (el.hasAttribute("data-cms-html")) el.innerHTML = text[key];
      else el.textContent = text[key];
    }
  });

  if (text.contact_email) {
    var emailEl = document.querySelector('[data-cms="contact_email"]');
    if (emailEl) emailEl.setAttribute("href", "mailto:" + text.contact_email);
  }
  if (text.contact_phone) {
    var phoneEl = document.querySelector('[data-cms="contact_phone"]');
    if (phoneEl) phoneEl.setAttribute("href", "tel:" + text.contact_phone.replace(/[^+\d]/g, ""));
  }

  /* ---------------- hero ---------------- */
  var heroVideo = document.getElementById("heroVideo");
  var heroImg = document.getElementById("heroImg");

  if (media.hero_video && heroVideo) {
    var videoUrl = media.hero_video.url;
    if (videoUrl && videoUrl.indexOf('api.telegram.org') === -1) {
      heroVideo.querySelectorAll("source").forEach(function (s) { s.remove(); });
      heroVideo.src = videoUrl;
      heroVideo.load();
      var pv = heroVideo.play();
      if (pv && pv.catch) pv.catch(function () {});
    }
  }
  if (media.hero_poster) {
    setImg(heroImg, media.hero_poster.url);
    if (heroVideo) heroVideo.setAttribute("poster", media.hero_poster.url);
  }
  if (media.about_portrait) setImg(document.querySelector(".about__portrait img"), media.about_portrait.url);
  if (media.cta_bg) {
    var bg = document.querySelector(".cta__bg");
    if (bg) bg.style.backgroundImage = "url('" + media.cta_bg.url + "')";
  }

  /* ---------------- rendered items: services ---------------- */
  document.querySelectorAll(".service-card").forEach(function (card, i) {
    var n = i + 1;
    tagText(card.querySelector("h3"), "service." + n + ".title");
    tagText(card.querySelector(".service-card__desc"), "service." + n + ".desc");
    tagMedia(card.querySelector(".service-card__media img"), "service_" + n);
  });

  /* ---------------- rendered items: stories (landing) ---------------- */
  document.querySelectorAll(".story-row").forEach(function (row, i) {
    var n = i + 1;
    var link = row.querySelector('.story-row__title a, .story-row__media a');
    var slug = "";
    if (link) {
      var m = (link.getAttribute("href") || "").match(/[?&]id=([^&]+)/);
      slug = m ? decodeURIComponent(m[1]) : "";
    }
    tagText(row.querySelector(".story-row__title a"), "story." + (slug || n) + ".title");
    tagText(row.querySelector(".story-row__excerpt"), "story." + (slug || n) + ".excerpt");
    var spans = row.querySelectorAll(".story-row__meta span");
    if (spans[0]) tagText(spans[0], "story." + (slug || n) + ".couple");
    if (spans[1]) tagText(spans[1], "story." + (slug || n) + ".location");
    if (spans[2]) tagText(spans[2], "story." + (slug || n) + ".date");
    tagMedia(row.querySelector(".story-row__media img"), "story." + (slug || n) + ".cover");
  });

  /* ---------------- rendered items: testimonials ---------------- */
  document.querySelectorAll(".carousel__slide").forEach(function (slide, i) {
    var n = i + 1;
    tagText(slide.querySelector(".carousel__quote"), "testi." + n + ".quote");
    var names = slide.querySelector(".carousel__names b");
    var loc = slide.querySelector(".carousel__names span");
    if (names) tagText(names, "testi." + n + ".names");
    if (loc) tagText(loc, "testi." + n + ".location");
  });

  /* ---------------- gallery + wall ---------------- */
  document.querySelectorAll("#masonry .masonry__item img").forEach(function (img, i) {
    tagMedia(img, "gallery_" + (i + 1));
  });
  document.querySelectorAll("#wallBoard .wall-item img").forEach(function (img, i) {
    tagMedia(img, "wall_" + (i + 1));
  });

  /* ---------------- story detail page (story.html?id=slug) ---------------- */
  var storyMain = document.getElementById("storyMain");
  if (storyMain) {
    var sm = (location.search || "").match(/[?&]id=([^&]+)/);
    var slug = sm ? decodeURIComponent(sm[1]) : "";
    if (slug) {
      tagText(storyMain.querySelector(".story-hero__couple"), "story." + slug + ".couple");
      tagText(storyMain.querySelector(".story-hero__title"), "story." + slug + ".title");
      tagMedia(storyMain.querySelector("#storyHeroImg"), "story." + slug + ".cover");

      storyMain.querySelectorAll(".story-body__text p").forEach(function (p, i) {
        if (i < 2) tagText(p, "story." + slug + ".desc" + (i + 1));
      });

      storyMain.querySelectorAll(".story-details div").forEach(function (div) {
        var dt = div.querySelector("dt");
        var dd = div.querySelector("dd");
        if (!dt || !dd) return;
        var k = dt.textContent.trim().toLowerCase();
        if (k === "location") tagText(dd, "story." + slug + ".location");
        if (k === "date") tagText(dd, "story." + slug + ".date");
      });

      storyMain.querySelectorAll(".story-gallery figure img").forEach(function (img, i) {
        if (i < 3) tagMedia(img, "story." + slug + ".img" + (i + 1));
      });
    }
  }

  /* ======================================================================
     INLINE EDITOR — only when an admin session exists
     ====================================================================== */
  fetch("/api/admin/status", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (s) { if (s && s.admin) initEditor(); })
    .catch(function () { /* not an admin, ignore */ });

  function initEditor() {
    /* ---------- inject styles ---------- */
    var css = document.createElement("style");
    css.textContent = [
      ".cms-toolbar{position:fixed;right:18px;bottom:18px;z-index:99999;display:flex;gap:8px;align-items:center;",
      "background:rgba(15,14,12,.92);backdrop-filter:blur(8px);border:1px solid rgba(194,160,107,.4);",
      "border-radius:100px;padding:8px 10px 8px 16px;font-family:Jost,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)}",
      ".cms-toolbar .cms-mode{color:#f7f3ec;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;margin-right:4px}",
      ".cms-toolbar button,.cms-toolbar a{background:none;border:1px solid rgba(194,160,107,.5);color:#d9c49c;",
      "font:600 .68rem Jost,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:7px 14px;",
      "border-radius:100px;cursor:pointer;text-decoration:none;transition:all .25s}",
      ".cms-toolbar button:hover,.cms-toolbar a:hover{background:#c2a06b;color:#0f0e0c}",
      ".cms-toolbar button.is-on{background:#c2a06b;color:#0f0e0c}",
      ".cms-editing [data-cms]{outline:1.5px dashed rgba(194,160,107,.75);outline-offset:3px;cursor:text;",
      "transition:outline-color .2s;min-height:1em}",
      ".cms-editing [data-cms]:hover{outline-color:#d9c49c;background:rgba(194,160,107,.08)}",
      ".cms-editing .cms-edit-active{outline:2px solid #c2a069 !important;background:rgba(194,160,107,.12)}",
      ".cms-editing [data-cms-slot]{cursor:pointer}",
      ".cms-editing [data-cms-slot]:hover{outline:1.5px dashed rgba(194,160,107,.9);outline-offset:2px}",
      ".cms-chip{position:fixed;z-index:99998;background:#c2a06b;color:#0f0e0c;font:600 .62rem Jost,system-ui,sans-serif;",
      "letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:100px;cursor:pointer;",
      "box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:auto;white-space:nowrap}",
      ".cms-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(8px);z-index:99999;",
      "background:#0f0e0c;color:#f7f3ec;border:1px solid rgba(194,160,107,.5);padding:9px 18px;border-radius:100px;",
      "font:.78rem Jost,system-ui,sans-serif;letter-spacing:.06em;opacity:0;pointer-events:none;transition:all .3s}",
      ".cms-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}",
      ".cms-editing .hero__shade,.cms-editing .hero__vignette{pointer-events:none}"
    ].join("");
    document.head.appendChild(css);

    /* ---------- toolbar ---------- */
    var bar = document.createElement("div");
    bar.className = "cms-toolbar";
    bar.innerHTML =
      '<span class="cms-mode">Admin</span>' +
      '<button type="button" data-act="toggle">Edit: Off</button>' +
      '<a href="/admin/dashboard" target="_blank" rel="noopener">Panel</a>' +
      '<a href="/admin/auth/logout">Logout</a>';
    document.body.appendChild(bar);

    var toast = document.createElement("div");
    toast.className = "cms-toast";
    document.body.appendChild(toast);
    var toastTimer = null;
    function say(msg) {
      toast.textContent = msg;
      toast.classList.add("is-show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove("is-show"); }, 2200);
    }

    var editing = false;
    var toggleBtn = bar.querySelector('[data-act="toggle"]');
    function setEditing(on) {
      editing = on;
      document.body.classList.toggle("cms-editing", on);
      toggleBtn.textContent = on ? "Edit: On" : "Edit: Off";
      toggleBtn.classList.toggle("is-on", on);
      if (!on) commitActiveText();
    }
    toggleBtn.addEventListener("click", function () { setEditing(!editing); });

    /* ---------- text editing ---------- */
    var activeText = null;
    function commitActiveText() {
      if (!activeText) return;
      var el = activeText;
      activeText = null;
      el.contentEditable = "false";
      el.classList.remove("cms-edit-active");
      var key = el.getAttribute("data-cms");
      var value = el.hasAttribute("data-cms-html") ? el.innerHTML : (el.textContent || "").trim();
      saveText(key, value);
    }
    function saveText(key, value) {
      fetch("/api/admin/text", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key, value: value })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { say(d.success ? "Saved ✓" : (d.error || "Save failed")); })
        .catch(function () { say("Save failed"); });
    }

    /* ---------- media slots ---------- */
    var mediaTargets = [];
    document.querySelectorAll("[data-cms-slot]").forEach(function (el) {
      mediaTargets.push({ el: el, slot: el.getAttribute("data-cms-slot") });
    });

    function pickAndUpload(slot, el) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = (slot === "hero_video") ? "video/mp4,video/webm" : "image/*";
      input.onchange = function () {
        if (!input.files.length) return;
        var fd = new FormData();
        fd.append("media", input.files[0]);
        say("Uploading…");
        fetch("/api/admin/media/" + encodeURIComponent(slot), {
          method: "POST",
          credentials: "same-origin",
          body: fd
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d.success) throw new Error(d.error || "Upload failed");
            applyMediaLive(slot, el, d.url);
            say("Uploaded ✓");
          })
          .catch(function (e) { say(e.message || "Upload failed"); });
      };
      input.click();
    }

    function applyMediaLive(slot, el, url) {
      if (slot === "hero_video" && el) {
        el.querySelectorAll("source").forEach(function (s) { s.remove(); });
        el.src = url;
        el.load();
        var pr = el.play();
        if (pr && pr.catch) pr.catch(function () {});
      } else if (slot === "cta_bg") {
        el.style.backgroundImage = "url('" + url + "')";
      } else if (el) {
        setImg(el, url);
        if (slot === "hero_poster" && heroVideo) heroVideo.setAttribute("poster", url);
      }
    }

    /* ---------- global click handling in edit mode ---------- */
    document.addEventListener("click", function (e) {
      if (!editing) return;

      /* media first */
      var mediaEl = e.target.closest("[data-cms-slot]");
      if (mediaEl) {
        e.preventDefault();
        e.stopPropagation();
        pickAndUpload(mediaEl.getAttribute("data-cms-slot"), mediaEl);
        return;
      }

      /* text */
      var textEl = e.target.closest("[data-cms]");
      if (textEl && !textEl.isContentEditable) {
        e.preventDefault();
        e.stopPropagation();
        activeText = textEl;
        textEl.contentEditable = "true";
        textEl.classList.add("cms-edit-active");
        textEl.focus();
        var range = document.createRange();
        range.selectNodeContents(textEl);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        textEl.addEventListener("blur", function onBlur() {
          textEl.removeEventListener("blur", onBlur);
          commitActiveText();
        });
        textEl.addEventListener("keydown", function onKey(ev) {
          if (ev.key === "Enter" && !ev.shiftKey && !textEl.hasAttribute("data-cms-html")) {
            ev.preventDefault();
            textEl.blur();
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            activeText = null;
            textEl.contentEditable = "false";
            textEl.classList.remove("cms-edit-active");
            textEl.removeEventListener("blur", onBlur);
          }
        });
        return;
      }

      /* block normal navigation on section links while editing */
      var link = e.target.closest("a[href^='#'], .story-row__link, .nav__lang, .hero__scrollcue");
      if (link) { e.preventDefault(); }
    }, true);

    /* ---------- hover chip for media ---------- */
    var chip = document.createElement("div");
    chip.className = "cms-chip";
    chip.textContent = "Click to replace";
    chip.style.display = "none";
    chip.addEventListener("click", function () {
      if (chipTarget) pickAndUpload(chipTarget.getAttribute("data-cms-slot"), chipTarget);
    });
    document.body.appendChild(chip);
    var chipTarget = null;

    document.addEventListener("mouseover", function (e) {
      if (!editing) { chip.style.display = "none"; return; }
      var t = e.target.closest("[data-cms-slot]");
      chipTarget = t;
      if (!t) { chip.style.display = "none"; return; }
      var r = t.getBoundingClientRect();
      chip.style.display = "block";
      chip.style.left = Math.max(8, Math.min(window.innerWidth - chip.offsetWidth - 8, r.right - chip.offsetWidth)) + "px";
      chip.style.top = Math.max(8, r.top - 26) + "px";
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest("[data-cms-slot]")) {
        chip.style.display = "none";
        chipTarget = null;
      }
    });
  }
})();
