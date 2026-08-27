/* ==========================================================================
   RENDER — builds all data-driven sections from window.SITE (js/content.js)
   ========================================================================== */
(function () {
  "use strict";

  var SITE = window.SITE || {};

  /* Placeholder used if a photograph fails to load */
  var PLACEHOLDER =
    "data:image/svg+xml," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='900' height='1100'>" +
      "<rect width='100%' height='100%' fill='#161411'/>" +
      "<rect x='14' y='14' width='calc(100% - 28px)' height='calc(100% - 28px)' fill='none' stroke='#c2a06b' stroke-opacity='.35'/>" +
      "<text x='50%' y='50%' fill='#c2a06b' font-family='Georgia,serif' font-size='34' text-anchor='middle' letter-spacing='6'>IM</text>" +
      "</svg>"
    );

  function guardImages(root) {
    (root || document).querySelectorAll("img").forEach(function (im) {
      if (im.dataset.guarded) return;
      im.dataset.guarded = "1";
      im.addEventListener("error", function () {
        im.src = PLACEHOLDER;
      }, { once: true });
    });
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------------- SERVICES ---------------- */
  function renderServices() {
    var grid = document.getElementById("servicesGrid");
    if (!grid || !SITE.services) return;
    SITE.services.forEach(function (s) {
      var card = el("article", "service-card");
      card.setAttribute("data-reveal", "");
      card.innerHTML =
        '<div class="service-card__media"><img src="' + s.image + '" alt="" loading="lazy" decoding="async" /></div>' +
        '<div class="service-card__veil" aria-hidden="true"></div>' +
        '<div class="service-card__body">' +
          "<h3>" + s.title + "</h3>" +
          '<span class="service-card__rule" aria-hidden="true"></span>' +
          '<p class="service-card__desc">' + s.desc + "</p>" +
        "</div>";
      var img = card.querySelector("img");
      img.alt = s.title + " — wedding photography service";
      grid.appendChild(card);
    });
  }

  /* ---------------- STORIES ---------------- */
  function renderStories() {
    var list = document.getElementById("storiesList");
    if (!list || !SITE.stories) return;
    SITE.stories.forEach(function (st, i) {
      var row = el("article", "story-row");
      row.setAttribute("data-reveal-group", "");
      row.innerHTML =
        '<figure class="story-row__media" data-reveal="right">' +
          '<a href="story.html?id=' + st.slug + '" aria-label="View story: ' + st.title + '">' +
            '<img src="' + st.cover + '" alt="' + (st.couple + " — " + st.location) + '" loading="lazy" decoding="async" />' +
          "</a>" +
        "</figure>" +
        '<div class="story-row__text">' +
          '<span class="story-row__index" data-reveal>Story ' + String(i + 1).padStart(2, "0") + "</span>" +
          '<h3 class="story-row__title" data-reveal><a href="story.html?id=' + st.slug + '">' + st.title + "</a></h3>" +
          '<p class="story-row__excerpt" data-reveal>' + st.excerpt + "</p>" +
          '<p class="story-row__meta" data-reveal><span>' + st.couple + "</span><span>" + st.location + "</span><span>" + st.date + "</span></p>" +
          '<a class="story-row__link" href="story.html?id=' + st.slug + '" data-reveal>View Story <span aria-hidden="true">&rarr;</span></a>' +
        "</div>";
      list.appendChild(row);
    });
  }

  /* ---------------- GALLERY (masonry) ---------------- */
  function renderGallery() {
    var wrap = document.getElementById("masonry");
    if (!wrap || !SITE.gallery) return;
    SITE.gallery.forEach(function (g, i) {
      var fig = el("button", "masonry__item");
      fig.type = "button";
      fig.setAttribute("data-reveal", "");
      fig.style.setProperty("--d", (i % 3) * 0.09 + "s");
      fig.setAttribute("aria-label", "Open photograph: " + g.alt);
      var mImg = el("img");
      mImg.src = g.src;
      mImg.alt = g.alt;
      mImg.loading = "lazy";
      mImg.decoding = "async";
      if (g.ratio) mImg.style.aspectRatio = g.ratio;
      fig.appendChild(mImg);
      fig.appendChild(Object.assign(el("span", "masonry__caption"), { textContent: g.alt }));
      fig.addEventListener("click", function () {
        window.Lightbox.open(
          SITE.gallery.map(function (x) { return { src: x.large || x.src, alt: x.alt }; }),
          i
        );
      });
      wrap.appendChild(fig);
    });
  }

  /* ---------------- PHOTO WALL ---------------- */
  function renderWall() {
    var board = document.getElementById("wallBoard");
    if (!board || !SITE.wall) return;
    SITE.wall.forEach(function (w, i) {
      var b = el("button", "wall-item");
      b.type = "button";
      b.style.setProperty("--tilt", w.rotate + "deg");
      b.setAttribute("aria-label", "Open photograph: " + w.alt);
      if (window.matchMedia("(max-width: 760px)").matches && i > 1) {
        // panels handled in CSS; nothing extra needed here
      }
      b.innerHTML = '<img src="' + w.src + '" alt="' + w.alt + '" loading="lazy" decoding="async" />';
      b.addEventListener("click", function () {
        window.Lightbox.open(
          SITE.wall.map(function (x) { return { src: x.src, alt: x.alt }; }),
          i
        );
      });
      board.appendChild(b);
    });
  }

  /* ---------------- TESTIMONIALS ---------------- */
  function renderTestimonials() {
    var track = document.getElementById("carouselTrack");
    if (!track || !SITE.testimonials) return;

    var viewport = document.createElement("div");
    viewport.className = "carousel__viewport";
    track.parentNode.insertBefore(viewport, track);
    viewport.appendChild(track);

    SITE.testimonials.forEach(function (t) {
      var slide = el("figure", "carousel__slide");
      slide.setAttribute("aria-roledescription", "slide");
      slide.innerHTML =
        '<blockquote class="carousel__quote">' + t.quote.replace(/^"|"$/g, "") + "</blockquote>" +
        '<figcaption class="carousel__who">' +
          '<span class="carousel__initials" aria-hidden="true">' + t.initials + "</span>" +
          '<span class="carousel__names"><b>' + t.names + "</b><span>" + t.location + "</span></span>" +
        "</figcaption>";
      track.appendChild(slide);
    });

    /* --- minimal, tasteful carousel behaviour --- */
    var count = document.getElementById("carCount");
    var prev = document.getElementById("carPrev");
    var next = document.getElementById("carNext");
    var total = SITE.testimonials.length;
    var idx = 0;
    var timer = null;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function go(n) {
      idx = (n + total) % total;
      track.style.transform = "translateX(-" + idx * 100 + "%)";
      count.textContent = String(idx + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
    }
    function auto() {
      if (reduceMotion || total < 2) return;
      stop();
      timer = setInterval(function () { go(idx + 1); }, 7000);
    }
    function stop() { if (timer) clearInterval(timer), timer = null; }

    prev.addEventListener("click", function () { go(idx - 1); auto(); });
    next.addEventListener("click", function () { go(idx + 1); auto() ;});
    go(0); auto();

    var region = document.getElementById("carousel");
    region.addEventListener("mouseenter", stop);
    region.addEventListener("mouseleave", auto);
    region.addEventListener("focusin", stop);
    region.addEventListener("focusout", auto);

    /* swipe */
    var startX = null;
    region.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    region.addEventListener("pointerup", function (e) {
      if (startX == null) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 42) { go(idx + (dx < 0 ? 1 : -1)); auto(); }
      startX = null;
    });
  }

  /* ---------------- FOOTER YEAR ---------------- */
  function stampYear() {
    document.querySelectorAll("#year").forEach(function (y) {
      y.textContent = new Date().getFullYear();
    });
  }

  /* ---------------- INIT ---------------- */
  function init() {
    renderServices();
    renderStories();
    renderGallery();
    renderWall();
    renderTestimonials();
    stampYear();
    guardImages(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
