/* Centurio web — tiny, dependency-free, no cookies.
   Stores only a language preference in localStorage (functional, not tracking). */
(function () {
  "use strict";

  var STORE_KEY = "centurio.lang";
  var root = document.documentElement;

  function setLang(lang, persist) {
    if (lang !== "es" && lang !== "en") lang = "es";
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    var btns = document.querySelectorAll("[data-set-lang]");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-set-lang") === lang;
      btns[i].classList.toggle("active", on);
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (persist) {
      try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    }
  }

  // Initial language: saved pref → browser language → Spanish default.
  function initialLang() {
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (saved === "es" || saved === "en") return saved;
    var nav = (navigator.language || "es").toLowerCase();
    return nav.indexOf("en") === 0 ? "en" : "es";
  }

  setLang(initialLang(), false);

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-set-lang]") : null;
    if (t) {
      e.preventDefault();
      setLang(t.getAttribute("data-set-lang"), true);
    }
  });

  // Nav border on scroll.
  var nav = document.getElementById("nav");
  if (nav) {
    var onScroll = function () {
      if (window.scrollY > 8) nav.classList.add("scrolled");
      else nav.classList.remove("scrolled");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // FAQ: keep only one <details> open at a time (graceful, optional).
  var faqs = document.querySelectorAll(".faq .qa");
  for (var i = 0; i < faqs.length; i++) {
    faqs[i].addEventListener("toggle", function (ev) {
      if (!ev.target.open) return;
      for (var j = 0; j < faqs.length; j++) {
        if (faqs[j] !== ev.target) faqs[j].removeAttribute("open");
      }
    });
  }

  // Current year in the footer.
  var y = document.getElementById("year");
  if (y) {
    try { y.textContent = String(new Date().getFullYear()); } catch (e) {}
  }

  // Scroll-reveal entrance animations (landing only; no-op elsewhere).
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      for (var k = 0; k < reveals.length; k++) reveals[k].classList.add("in");
    } else {
      var io = new IntersectionObserver(function (entries) {
        for (var n = 0; n < entries.length; n++) {
          if (entries[n].isIntersecting) {
            entries[n].target.classList.add("in");
            io.unobserve(entries[n].target);
          }
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      for (var m = 0; m < reveals.length; m++) io.observe(reveals[m]);
    }
  }
})();
