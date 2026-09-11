/* shariarkabir.com — theme toggle, mobile nav, scroll reveal, and the network-graph animation in the header band. */
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

  /* Reveal on scroll (with a safety net so nothing stays hidden) */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if ("IntersectionObserver" in window && !reduced) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
      reveals.forEach(function (el) { io.observe(el); });
      setTimeout(function () { reveals.forEach(function (el) { el.classList.add("is-visible"); }); }, 700);
    } else {
      reveals.forEach(function (el) { el.classList.add("is-visible"); });
    }
  }


  /* Blog index: filter by topic (buttons in .tagbar toggle list items by data-tags) */
  var tagbar = document.querySelector(".tagbar");
  if (tagbar) {
    var items = document.querySelectorAll(".post-list li[data-tags]");
    var empty = document.querySelector(".tagbar__empty");
    function applyTag(tag) {
      var shown = 0;
      items.forEach(function (li) {
        var ok = !tag || (" " + li.getAttribute("data-tags") + " ").indexOf(" " + tag + " ") !== -1;
        li.hidden = !ok; if (ok) shown++;
      });
      tagbar.querySelectorAll("button").forEach(function (b) { b.classList.toggle("is-active", (b.getAttribute("data-tag") || "") === tag); });
      if (empty) empty.hidden = shown > 0;
    }
    tagbar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var tag = b.getAttribute("data-tag") || "";
      applyTag(tag);
      if (history.replaceState) history.replaceState(null, "", tag ? "#" + tag : location.pathname);
    });
    var initial = (location.hash || "").slice(1);
    if (initial && tagbar.querySelector('button[data-tag="' + initial + '"]')) applyTag(initial);
  }

  /* Footer year */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     Network graph animation: drifting nodes, proximity edges, and
     "packets" travelling along edges. Evokes 6G / Zero Trust / neural nets.
     Cheap: capped node count, DPR-aware, pauses when hidden or offscreen.
     ------------------------------------------------------------------ */
  var canvas = document.querySelector("canvas[data-network]");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1, nodes = [], packets = [], raf = null, running = false, last = 0;
  var LINK = 150;

  function resize() {
    var full = canvas.classList.contains("bg-net");
    var r = full ? { width: window.innerWidth, height: window.innerHeight } : canvas.parentElement.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var count = Math.round(Math.min(90, Math.max(36, (W * H) / 14000)));
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: 1.2 + Math.random() * 1.8, hub: Math.random() < .12 });
    }
    packets = [];
  }

  function spawnPacket() {
    if (packets.length > 10) return;
    var a = nodes[Math.floor(Math.random() * nodes.length)];
    var best = null, bd = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var b = nodes[i]; if (b === a) continue;
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < LINK && d < bd && Math.random() < .6) { bd = d; best = b; }
    }
    if (best) packets.push({ a: a, b: best, t: 0, speed: .012 + Math.random() * .012 });
  }

  function draw(ts) {
    var light = root.getAttribute("data-theme") !== "dark";
    if (!running) return;
    var dt = Math.min(32, ts - last || 16); last = ts;
    ctx.clearRect(0, 0, W, H);
    var i, j, a, b;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      a.x += a.vx * dt * .06; a.y += a.vy * dt * .06;
      if (a.x < -10) a.x = W + 10; if (a.x > W + 10) a.x = -10;
      if (a.y < -10) a.y = H + 10; if (a.y > H + 10) a.y = -10;
    }
    /* edges */
    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          var d = Math.sqrt(d2), alpha = (1 - d / LINK) * .35;
          ctx.strokeStyle = (light ? "rgba(47,109,246," : "rgba(143,180,255,") + (light ? alpha * 0.7 : alpha).toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    /* nodes */
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      ctx.beginPath(); ctx.arc(a.x, a.y, a.hub ? a.r + 1.4 : a.r, 0, Math.PI * 2);
      ctx.fillStyle = a.hub ? (light ? "rgba(25,150,190,.9)" : "rgba(61,211,240,.95)") : (light ? "rgba(47,109,246,.55)" : "rgba(200,216,255,.75)");
      ctx.fill();
      if (a.hub) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 6, 0, Math.PI * 2); ctx.strokeStyle = light ? "rgba(25,150,190,.25)" : "rgba(61,211,240,.25)"; ctx.stroke(); }
    }
    /* packets */
    if (Math.random() < .06) spawnPacket();
    for (i = packets.length - 1; i >= 0; i--) {
      var p = packets[i]; p.t += p.speed * dt * .06;
      if (p.t >= 1) { packets.splice(i, 1); continue; }
      var px = p.a.x + (p.b.x - p.a.x) * p.t, py = p.a.y + (p.b.y - p.a.y) * p.t;
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = light ? "rgba(31,79,196,.95)" : "rgba(255,255,255,.95)"; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = light ? "rgba(31,79,196,.2)" : "rgba(61,211,240,.25)"; ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }

  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(draw); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  resize();
  window.addEventListener("resize", function () { resize(); if (reduced) { running = true; draw(16); running = false; } }, { passive: true });

  if (reduced) { running = true; draw(16); running = false; return; }   /* one static frame */

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }, { threshold: 0 }).observe(canvas);
  } else { start(); }
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : (canvas.getBoundingClientRect().bottom > 0 && start()); });
})();
