/* ==========================================================================
   CAMERA TRANSITION — signature scroll-linked animation
   The hero film performs an iris zoom-out: the full-screen frame shrinks
   into a circle and collapses into the dark. Out of that darkness the
   vintage cine-camera rises, reels winding with the scroll, dives into its
   top film reel, and the photograph splits into frames that wind upward
   like film through a reel before the About section is revealed.
   Falls back to a static divider when GSAP is unavailable or the visitor
   prefers reduced motion.
   ========================================================================== */
(function () {
  "use strict";

  var intro = document.getElementById("home");
  var stage = document.getElementById("cameraStage");
  var panelsWrap = document.getElementById("panels");
  if (!intro || !stage || !panelsWrap) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
                     !/[?&]motion=full/.test(location.search);
  var hasGsap = typeof window.gsap !== "undefined" &&
                typeof window.ScrollTrigger !== "undefined";

  var PHOTO = (window.SITE && SITE.hero && SITE.hero.image) ||
              (document.getElementById("heroImg") || {}).src || "";

  /* ---------- Build the six viewfinder panels ---------- */
  function buildPanels() {
    var cols = 3, rows = 2;
    var isNarrow = window.matchMedia("(max-width: 760px)");
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var p = document.createElement("div");
        p.className = "panel";
        p.style.setProperty("--col", c);
        p.style.setProperty("--row", r);
        p.style.setProperty("--photo", "url('" + PHOTO + "')");
        /* on narrow screens only a 2×2 viewfinder is shown */
        if (c === 2) p.setAttribute("data-mobile", "hide");
        panelsWrap.appendChild(p);
      }
    }
    return isNarrow;
  }

  function staticFallback() {
    stage.style.display = "none";
    var divider = document.getElementById("introDivider");
    if (divider) divider.hidden = false;
  }

  /* ---------- The scrubbed timeline ---------- */
  function play() {
    gsap.registerPlugin(ScrollTrigger);

    var reelA = stage.querySelector('[data-reel="a"] .cc-reel-rot');
    var reelB = stage.querySelector('[data-reel="b"] .cc-reel-rot');
    var navEl = document.getElementById("nav");

    gsap.set(stage, { autoAlpha: 0 });
    gsap.set(".hero__media", { borderRadius: "0px", transformOrigin: "50% 50%" });

    var tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: {
        trigger: intro,
        start: "top top",
        end: function () {
          return window.innerWidth <= 760 ? "+=260%" : "+=320%";
        },
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var p = self.progress;
          intro.classList.toggle("is-animating", p > 0.02);
          /* scroll-linked nav fade: visible at rest, dissolves as the film
             begins, returns for the world beyond the intro */
          if (navEl) {
            /* kill the entrance animation so scroll-linked opacity can win */
            if (p > 0.02 && navEl.style.animation !== "none") {
              navEl.style.animation = "none";
            }
            var alpha = p <= 0.04
              ? 1 - p / 0.04
              : (p >= 0.9 ? Math.min((p - 0.9) / 0.08, 1) : 0);
            gsap.set(navEl, { autoAlpha: alpha });
          }
        }
      }
    });

    /* Phase 1 — hero text drifts up and dissolves (0 – 0.28) */
    tl.to(".hero__content", {
      yPercent: -26,
      autoAlpha: 0,
      duration: 0.26,
      ease: "power1.in"
    }, 0);
    tl.to(".hero__scrollcue", {
      autoAlpha: 0, y: 14, duration: 0.1, ease: "power1.in"
    }, 0);

    /* Phase 1b — iris zoom-out: the full-screen film rounds off, shrinks
       into a perfect circle and collapses into the dark (0.05 – 0.52) */
    tl.to(".hero__media", {
      scale: 0.5,
      borderRadius: function () { return Math.min(window.innerWidth, window.innerHeight) / 2; },
      duration: 0.26,
      ease: "power2.inOut"
    }, 0.05);
    tl.to(".hero__media", {
      scale: 0.12,
      duration: 0.14,
      ease: "power2.in"
    }, 0.31);
    tl.to(".hero__media", {
      scale: 0.001,
      autoAlpha: 0,
      duration: 0.07,
      ease: "power3.in"
    }, 0.45);
    /* the veil behind fades to charcoal only after the circle has fully
       collapsed — the intro's own charcoal backdrop frames the circle
       while it shrinks, so it stays visible above the dark */
    tl.set(stage, { autoAlpha: 1, backgroundColor: "rgba(15,14,12,0)" }, 0.1);
    tl.to(stage, { backgroundColor: "#0f0e0c", duration: 0.08, ease: "none" }, 0.48);

    /* Phase 2 — the cine-camera rises out of the darkness, reels winding
       with the scroll (0.56 – 0.8) */
    tl.fromTo(".camera",
      { y: 70, scale: 0.86, autoAlpha: 0 },
      { y: 0, scale: 1, autoAlpha: 1, duration: 0.24, ease: "power2.out" }, 0.56);
    if (reelA && reelB) {
      tl.to(reelA, { rotation: 320, svgOrigin: "150 78", ease: "none", duration: 0.92 }, 0.56);
      tl.to(reelB, { rotation: -360, svgOrigin: "222 72", ease: "none", duration: 0.92 }, 0.56);
    }

    /* Phase 3 — zoom: the camera dives into its top film reel (0.88 – 1.08) */
    tl.to(".camera", {
      scale: 6,
      y: 70,
      transformOrigin: "52% 23%",
      ease: "power2.in",
      duration: 0.2
    }, 0.88);
    tl.to(".camera", { autoAlpha: 0, duration: 0.05 }, 1.04);

    /* flash through the lens (1.04 – 1.16) */
    tl.fromTo("#cameraFlash", { autoAlpha: 0 },
      { autoAlpha: 0.95, duration: 0.05, ease: "power1.in" }, 1.05);
    tl.to("#cameraFlash", { autoAlpha: 0, duration: 0.22, ease: "power2.out" }, 1.11);

    /* Phase 4 — the photograph splits into frames (1.08 – 1.24) */
    tl.to(".gl-v1, .gl-v2", { scaleY: 1, duration: 0.14, ease: "power3.out" }, 1.08);
    tl.to(".gl-h", { scaleX: 1, duration: 0.14, ease: "power3.out" }, 1.11);
    tl.to(".panel", {
      autoAlpha: 1,
      duration: 0.12,
      stagger: { each: 0.02, from: "center" },
      ease: "power1.out"
    }, 1.12);

    /* caption beat */
    tl.fromTo("#stageCaption",
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 0.1 }, 1.24);
    tl.to("#stageCaption", { autoAlpha: 0, y: -20, duration: 0.08 }, 1.5);

    /* Phase 5 — frames wind upward like film through a reel (1.28 – 1.64) */
    var panels = panelsWrap.querySelectorAll(".panel");
    panels.forEach(function (p, i) {
      var col = i % 3;
      var row = Math.floor(i / 3);
      var drift = (col - 1) * 7;          /* slight outward drift per column */
      var rise = row === 0 ? -175 : -255; /* bottom row travels a full extra frame */
      var at = 1.28 + col * 0.03 + row * 0.015;
      tl.to(p, {
        yPercent: rise,
        xPercent: drift,
        rotation: (col - 1) * 2.5,
        duration: 0.3,
        ease: "power2.in"
      }, at);
      tl.to(p, { autoAlpha: 0, duration: 0.14 }, at + 0.16);
    });
    tl.to(".frame-grid .gl", { autoAlpha: 0, duration: 0.12 }, 1.44);

    /* keep the last frame calm for an instant before release */
    tl.to({}, { duration: 0.1 });

    /* refresh measurements once imagery has loaded */
    window.addEventListener("load", function () {
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }

  /* ---------- Init ---------- */
  buildPanels();

  if (reduceMotion || !hasGsap || !PHOTO) {
    staticFallback();
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", play);
  } else {
    play();
  }
})();
