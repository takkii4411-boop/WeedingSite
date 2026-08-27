/* ==========================================================================
   STORY — renders a wedding story page from ?id=<slug> using SITE.stories
   ========================================================================== */
(function () {
  "use strict";

  var main = document.getElementById("storyMain");
  if (!main) return;

  var params = new URLSearchParams(location.search);
  var slug = params.get("id");
  var story = ((window.SITE && SITE.stories) || []).find(function (s) {
    return s.slug === slug;
  });

  if (!story) {
    main.innerHTML =
      '<div class="story-missing">' +
        '<h1>This story has wandered off.</h1>' +
        '<p><a class="btn" href="index.html#stories">Back to Stories</a></p>' +
      "</div>";
    return;
  }

  document.title = story.title + " — Isabella Marchetti Wedding Photography";

  var details = (story.details || [])
    .map(function (d) { return "<div><dt>" + d[0] + "</dt><dd>" + d[1] + "</dd></div>"; })
    .join("");

  var paragraphs = (story.description || [])
    .map(function (p) { return "<p>" + p + "</p>"; })
    .join("");

  var photos = (story.images || [])
    .map(function (im) {
      return (
        "<figure data-reveal>" +
          '<img src="' + im.src + '" alt="' + im.alt + '" loading="lazy" decoding="async" />' +
          "<figcaption>" + im.alt + "</figcaption>" +
        "</figure>"
      );
    })
    .join("");

  var others = ((window.SITE && SITE.stories) || [])
    .filter(function (s) { return s.slug !== story.slug; })
    .slice(0, 3)
    .map(function (s) {
      return (
        '<a class="related__card" href="story.html?id=' + s.slug + '">' +
          '<img src="' + s.cover + '" alt="' + s.title + '" loading="lazy" decoding="async" />' +
          "<b>" + s.title + "</b><span>" + s.location + " · " + s.date + "</span>" +
        "</a>"
      );
    })
    .join("");

  main.innerHTML =
    /* hero */
    '<section class="story-hero" aria-label="' + story.title + '">' +
      '<img id="storyHeroImg" src="' + story.cover + '" alt="' + story.couple + " — " + story.location + '" fetchpriority="high" decoding="async" />' +
      '<div class="story-hero__text container">' +
        '<a class="story-hero__back" href="index.html#stories">&larr; All Stories</a>' +
        '<p class="story-hero__couple">' + story.couple + "</p>" +
        '<h1 class="story-hero__title">' + story.title + "</h1>" +
      "</div>" +
    "</section>" +

    /* body */
    '<section class="container story-body">' +
      '<div class="story-body__text">' + paragraphs + "</div>" +
      '<dl class="story-details">' + details +
        "<div><dt>Location</dt><dd>" + story.location + "</dd></div>" +
        "<div><dt>Date</dt><dd>" + story.date + "</dd></div>" +
      "</dl>" +
    "</section>" +

    /* photographs */
    '<section class="container-wide story-gallery" aria-label="Wedding photographs">' + photos + "</section>" +

    /* related */
    '<section class="related">' +
      '<div class="container">' +
        "<h2>More stories</h2>" +
        '<div class="related__list">' + others + "</div>" +
      "</div>" +
    "</section>";

  /* wire gallery images to the lightbox */
  var list = (story.images || []).map(function (im) {
    return { src: im.src, alt: im.alt };
  });
  main.querySelectorAll(".story-gallery figure").forEach(function (fig, i) {
    fig.querySelector("img").addEventListener("click", function () {
      window.Lightbox.open(list, i);
    });
  });

  /* reveals */
  document.documentElement.classList.add("js");
  if ("IntersectionObserver" in window &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    main.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });
  } else {
    main.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("in");
    });
  }

  /* footer year */
  document.querySelectorAll("#year").forEach(function (y) {
    y.textContent = new Date().getFullYear();
  });

  /* guard broken images */
  main.querySelectorAll("img").forEach(function (im) {
    im.addEventListener("error", function () {
      im.style.minHeight = "320px";
      im.style.background = "#161411";
    }, { once: true });
  });
})();
