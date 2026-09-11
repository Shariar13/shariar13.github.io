/* shariarkabir.com — theme toggle, mobile nav, footer year. */
(function () {
  "use strict";
  var root = document.documentElement;
  var header = document.querySelector(".site-header");
  var nav = document.getElementById("nav");
  var navToggle = document.querySelector(".nav-toggle");
  var themeToggle = document.querySelector(".theme-toggle");
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Theme */
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* Mobile nav */
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") { nav.classList.remove("is-open"); navToggle.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("is-open")) { nav.classList.remove("is-open"); navToggle.setAttribute("aria-expanded", "false"); navToggle.focus(); } });
  }

  /* Header state */
  function onScroll() { if (header) header.classList.toggle("is-scrolled", (window.scrollY || 0) > 40); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();


  /* Footer year */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
