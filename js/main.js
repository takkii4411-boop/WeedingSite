/* ==========================================================================
   MAIN — sticky nav, mobile menu, scroll reveals, ambient parallax
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Cinematic curtain reveal ---------------- */
  var curtain = document.getElementById("curtain");

  function revealSite() {
    if (document.body.classList.contains("is-revealed")) return;
    document.body.classList.add("is-revealed");
    if (curtain && !reduceMotion) {
      setTimeout(function () { curtain.classList.add("is-done"); }, 1700);
    }
    /* entrance animations complete — release them so scroll effects take over */
    setTimeout(function () { document.body.classList.add("is-done"); }, 2400);
  }

  if (reduceMotion) {
    if (curtain && curtain.parentNode) curtain.parentNode.removeChild(curtain);
    document.body.classList.add("is-revealed");
    document.body.classList.add("is-done");
  } else {
    if (document.readyState === "complete") {
      setTimeout(revealSite, 300);
    } else {
      window.addEventListener("load", function () { setTimeout(revealSite, 300); });
    }
    /* safety: never trap the visitor behind the curtain */
    setTimeout(revealSite, 3200);
  }

  /* ---------------- Hero background video ---------------- */
  var heroVideo = document.getElementById("heroVideo");
  if (heroVideo) {
    heroVideo.addEventListener("playing", function () {
      heroVideo.classList.add("is-playing");
    });
    heroVideo.addEventListener("canplay", function () {
      var p = heroVideo.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked — poster stays */ });
    });
    /* if the video file can't load, quietly keep the poster image */
    heroVideo.addEventListener("error", function () {
      heroVideo.style.display = "none";
    }, true);
  }

  /* ---------------- Language switcher (visual) ---------------- */
  var langBtns = Array.prototype.slice.call(
    document.querySelectorAll(".nav__lang-btn")
  );
  langBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      langBtns.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      document.documentElement.setAttribute("lang", btn.dataset.lang || "en");
    });
  });

  /* ---------------- Sticky nav appearance ---------------- */
  var nav = document.getElementById("nav");
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      if (nav) nav.classList.toggle("nav--scrolled", window.scrollY > 48);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- Mobile menu ---------------- */
  var burger = document.getElementById("burger");
  var menu = document.getElementById("mobileMenu");

  function setMenu(open) {
    if (!burger || !menu) return;
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add("menu--open"); });
      document.body.classList.add("no-scroll");
      var first = menu.querySelector("a");
      if (first) first.focus({ preventScroll: true });
    } else {
      menu.classList.remove("menu--open");
      document.body.classList.remove("no-scroll");
      setTimeout(function () { menu.hidden = true; }, 480);
      burger.focus({ preventScroll: true });
    }
  }

  if (burger && menu) {
    burger.addEventListener("click", function () {
      setMenu(burger.getAttribute("aria-expanded") !== "true");
    });

    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setMenu(false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (menu.hidden || e.key !== "Escape") return;
      setMenu(false);
      return;
    });

    /* simple focus trap while the overlay is open */
    document.addEventListener("keydown", function (e) {
      if (menu.hidden || e.key !== "Tab") return;
      var focusables = Array.prototype.slice.call(
        menu.querySelectorAll("a, button"), 0
      ).concat([burger]);
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* ---------------- Scroll reveals ---------------- */
  var revealEls = document.querySelectorAll("[data-reveal]");

  /* stagger inside groups */
  document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
    group.querySelectorAll(":scope > [data-reveal], :scope [data-reveal]")
      .forEach(function (el, i) {
        if (!el.style.getPropertyValue("--d")) {
          el.style.setProperty("--d", Math.min(i * 0.1, 0.6).toFixed(2) + "s");
        }
      });
  });

  /* no-JS / reduced-motion safety: elements are hidden by CSS only under .js */
  document.documentElement.classList.add("js");

  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- Ambient parallax (optional) ---------------- */
  if (!reduceMotion && typeof window.gsap === "function" &&
      typeof window.ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    var bg = document.querySelector(".cta__bg");
    if (bg) {
      gsap.fromTo(bg,
        { yPercent: -8 },
        {
          yPercent: 8,
          ease: "none",
          scrollTrigger: {
            trigger: ".cta",
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        });
    }
    var portrait = document.querySelector(".about__portrait img");
    if (portrait) {
      gsap.fromTo(portrait,
        { yPercent: -5 },
        {
          yPercent: 5,
          ease: "none",
          scrollTrigger: {
            trigger: ".about",
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        });
    }
  }

  /* ---------------- Active section highlight in nav ---------------- */
  var sections = ["home", "about", "stories", "gallery", "services", "contact"]
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var links = {};
    document.querySelectorAll(".nav__links a").forEach(function (a) {
      var hash = (a.getAttribute("href") || "").replace("#", "");
      links[hash] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(links).forEach(function (k) {
          links[k].removeAttribute("aria-current");
        });
        var link = links[entry.target.id];
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }
})();
