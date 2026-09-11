#!/usr/bin/env node
/**
* build.js: static site builder for shariarkabir.com
 *
 * - Copies the static site (index.html, assets, config files) into ./dist
 * - Renders every Markdown post in ./content/posts into /blog/<slug>/index.html
 * - Generates /blog/index.html, /sitemap.xml, /feed.xml
 * - Injects the latest posts into the homepage between the BLOG:START/END markers
 *
 * Usage:  node build.js          (or: npm run build)
 * Only dependency: marked (Markdown → HTML)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const POSTS_DIR = path.join(ROOT, "content", "posts");

const SITE = {
  url: "https://shariarkabir.com",
  name: "Shariar Kabir",
  description: "Notes on AI, cybersecurity, Zero Trust and media forensics by Shariar Kabir, researcher at the University of Portsmouth.",
  author: {
    name: "Shariar Kabir",
    url: "https://shariarkabir.com/",
    image: "https://shariarkabir.com/assets/img/shariar-kabir-square.jpg",
    scholar: "https://scholar.google.com/citations?user=BpsdXu4AAAAJ",
    github: "https://github.com/Shariar13",
    linkedin: "https://www.linkedin.com/in/shariar13",
  },
  ogImage: "https://shariarkabir.com/assets/img/og-image.jpg",
  homepagePosts: 5,
  staticFiles: ["index.html", "cv.html", "publications.html", "404.html", "robots.txt", "_headers", "_redirects", "site.webmanifest",
    "favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
  staticDirs: ["assets"],
};

/* ------------------------------------------------------------------ utils */
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });
const write = (rel, content) => { const f = path.join(DIST, rel); mkdirp(path.dirname(f)); fs.writeFileSync(f, content); };
const copyDir = (src, dest) => { mkdirp(dest); for (const e of fs.readdirSync(src, { withFileTypes: true })) { const s = path.join(src, e.name), d = path.join(dest, e.name); e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } };
const slugify = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fmtDate = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const readingTime = (text) => Math.max(1, Math.round(text.trim().split(/\s+/).length / 220));

/** Minimal front-matter parser: `key: value`, quoted strings, [a, b] lists, true/false. */
function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (/^\[.*\]$/.test(val)) data[key] = val.slice(1, -1).split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    else if (/^["'].*["']$/.test(val)) data[key] = val.slice(1, -1).replace(/\\"/g, '"');
    else if (val === "true" || val === "false") data[key] = val === "true";
    else data[key] = val;
  }
  return { data, body: m[2] };
}

/* ---------------------------------------------------------- markdown setup */
const renderer = new marked.Renderer();
renderer.heading = function ({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const id = slugify(text.replace(/<[^>]+>/g, ""));
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};
renderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const external = /^https?:\/\//.test(href) && !href.startsWith(SITE.url);
  return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
};
renderer.image = function ({ href, title, text }) {
  return `<img src="${esc(href)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ""} loading="lazy" decoding="async">`;
};
marked.use({ gfm: true, breaks: false, renderer });

/* ----------------------------------------------------------------- posts */
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, body } = parseFrontMatter(raw);
      const slug = data.slug || file.replace(/\.md$/, "");
      if (!data.title) throw new Error(`Post ${file} is missing a title`);
      if (!data.date) throw new Error(`Post ${file} is missing a date (YYYY-MM-DD)`);
      const html = marked.parse(body);
      const plain = body.replace(/[#>*_`\[\]()!-]/g, " ").replace(/\s+/g, " ").trim();
      const description = data.description || (plain.length > 155 ? plain.slice(0, 152).replace(/\s\S*$/, "") + "…" : plain);
      return {
        slug, file, title: data.title, date: String(data.date), updated: data.updated ? String(data.updated) : null,
        description, tags: Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(",").map((t) => t.trim()) : []),
        image: data.image || null, draft: data.draft === true, html, minutes: readingTime(plain),
        url: `${SITE.url}/blog/${slug}/`, path: `/blog/${slug}/`,
      };
    })
    .filter((p) => !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* --------------------------------------------------------------- layout */
const ICON = {
  sun: '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  moon: '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  menu: '<svg class="icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrow: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
};

function layout({ title, description, canonical, body, ogType = "website", ogImage = SITE.ogImage, jsonLd = null, extraHead = "" }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="${esc(SITE.author.name)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="theme-color" content="#0a1226">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:locale" content="en_GB">
  <meta property="og:site_name" content="${esc(SITE.name)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)} | Writing" href="${SITE.url}/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap">
  <link rel="stylesheet" href="/assets/css/style.css">
  <script>(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();</script>
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
  ${extraHead}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header site-header--band">
  <div class="page site-header__inner">
    <a class="brand" href="/" aria-label="Shariar Kabir, home"><span class="brand__mark" aria-hidden="true">SK</span>Shariar Kabir</a>
    <nav class="site-nav" id="nav" aria-label="Primary">
      <a href="/#about">About</a>
      <a href="/#research">Research</a>
      <a href="/publications">Publications</a>
      <a href="/cv">CV</a>
      <a href="/blog/" class="is-active">Writing</a>
    </nav>
    <div class="header-tools">
      <button class="tool-btn theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle theme">${ICON.sun}${ICON.moon}</button>
      <button class="tool-btn nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav">${ICON.menu}${ICON.close}</button>
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="page site-footer__inner">
    <div>© <span data-year>${new Date().getFullYear()}</span> Shariar Kabir · School of Computing, Mathematics and Physics, University of Portsmouth</div>
    <nav aria-label="Footer">
      <a href="/#publications">Publications</a>
      <a href="/#awards">Awards</a>
      <a href="/blog/">Writing</a>
      <a href="/feed.xml">RSS</a>
      <a href="${SITE.author.scholar}" target="_blank" rel="noopener">Scholar</a>
      <a href="${SITE.author.github}" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </div>
</footer>
<script src="/assets/js/main.js" defer></script>
</body>
</html>
`;
}

const tagSlug = (t) => slugify(t);
function postItem(p) {
  return `<li data-tags="${p.tags.map(tagSlug).join(" ")}"><a class="card" href="${p.path}"><time datetime="${p.date}">${fmtDate(p.date)}</time><div><strong>${esc(p.title)}</strong><p>${esc(p.description)}</p>${p.tags.length ? `<span class="post-list__tags">${p.tags.map(esc).join(" · ")} · ${p.minutes} min</span>` : `<span class="post-list__tags">${p.minutes} min</span>`}</div>${ICON.arrow}</a></li>`;
}

/* ------------------------------------------------------------ renderers */
function renderPost(p, older, newer) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting", "@id": p.url + "#article", headline: p.title, description: p.description,
        datePublished: p.date, dateModified: p.updated || p.date, url: p.url, mainEntityOfPage: p.url, inLanguage: "en-GB",
        image: p.image ? SITE.url + p.image : SITE.ogImage, keywords: p.tags.join(", "), wordCount: p.minutes * 220,
        author: { "@type": "Person", "@id": SITE.url + "/#person", name: SITE.author.name, url: SITE.author.url },
        publisher: { "@type": "Person", "@id": SITE.url + "/#person", name: SITE.author.name },
      },
      {
        "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url + "/" },
          { "@type": "ListItem", position: 2, name: "Writing", item: SITE.url + "/blog/" },
          { "@type": "ListItem", position: 3, name: p.title, item: p.url },
        ],
      },
    ],
  };
  const shareUrl = encodeURIComponent(p.url), shareText = encodeURIComponent(p.title);
  const body = `
<div class="band band--slim">
  <canvas data-network aria-hidden="true"></canvas>
  <div class="page band__inner">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/blog/">Writing</a></nav>
    <h1>${esc(p.title)}</h1>
    <p class="band__desc">${esc(p.description)}</p>
    <div class="band__meta">
      <a class="band__author" href="/#about"><img src="/assets/img/shariar-kabir-square.jpg" alt="" width="28" height="28">Shariar Kabir</a>
      <span>${ICON.cal}<time datetime="${p.date}">${fmtDate(p.date)}</time></span>
      ${p.updated ? `<span>Updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time></span>` : ""}
      <span>${ICON.clock}${p.minutes} min read</span>
    </div>
    ${p.tags.length ? `<div class="band__topics">${p.tags.map((t) => `<a href="/blog/#${tagSlug(t)}">${esc(t)}</a>`).join("")}</div>` : ""}
  </div>
</div>
<div class="page">
<article class="article">
  ${p.image ? `<figure class="article__cover"><img src="${esc(p.image)}" alt="${esc(p.title)}" loading="eager" decoding="async"></figure>` : ""}
  <div class="prose">
${p.html}
  </div>
  <div class="article__tags">
    <span>Share:</span>
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener">LinkedIn</a>
    <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener">X</a>
    <a href="mailto:?subject=${shareText}&body=${shareUrl}">Email</a>
    <a href="/feed.xml">RSS</a>
  </div>
  <div class="author-box card">
    <img src="/assets/img/shariar-kabir-square.jpg" alt="Shariar Kabir" width="56" height="56" loading="lazy">
    <div>
      <strong>Shariar Kabir</strong>
      <p>Researcher in AI and cybersecurity, School of Computing, Mathematics and Physics, University of Portsmouth. UK Global Talent Visa, endorsed by UKRI.
      <a href="/#about">About</a> · <a href="${SITE.author.scholar}" target="_blank" rel="noopener">Google Scholar</a> · <a href="${SITE.author.linkedin}" target="_blank" rel="noopener">LinkedIn</a></p>
    </div>
  </div>
  <nav class="post-nav" aria-label="Post navigation">
    ${older ? `<a href="${older.path}" class="card prev"><small>Older</small><strong>${esc(older.title)}</strong></a>` : "<span></span>"}
    ${newer ? `<a href="${newer.path}" class="card next"><small>Newer</small><strong>${esc(newer.title)}</strong></a>` : ""}
  </nav>
</article>
</div>`;
  return layout({ title: `${p.title} | Shariar Kabir`, description: p.description, canonical: p.url, body, ogType: "article", ogImage: p.image ? SITE.url + p.image : SITE.ogImage, jsonLd,
    extraHead: `<meta property="article:published_time" content="${p.date}"><meta property="article:author" content="${SITE.author.url}">${p.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join("")}` });
}

function renderBlogIndex(posts) {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Blog", "@id": SITE.url + "/blog/#blog", url: SITE.url + "/blog/", name: "Shariar Kabir | Writing", description: SITE.description,
    author: { "@type": "Person", "@id": SITE.url + "/#person", name: SITE.author.name },
    blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: p.url, datePublished: p.date })),
  };
  const tagCount = {};
  posts.forEach((p) => p.tags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const tags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a] || a.localeCompare(b));
  const body = `
<div class="band band--slim">
  <canvas data-network aria-hidden="true"></canvas>
  <div class="page band__inner">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>Writing</nav>
    <h1>Writing</h1>
    <p class="band__desc">${esc(SITE.description)}</p>
    <div class="band__meta"><span>${posts.length} articles</span><span>By Shariar Kabir</span><span><a href="/feed.xml">RSS feed</a></span></div>
  </div>
</div>
<div class="page blog-index">
  <div class="tagbar" role="group" aria-label="Filter by topic">
    <button type="button" class="is-active" data-tag="">All</button>
    ${tags.map((t) => `<button type="button" data-tag="${tagSlug(t)}" id="${tagSlug(t)}">${esc(t)} <small>${tagCount[t]}</small></button>`).join("")}
  </div>
  ${posts.length ? `<ul class="post-list">${posts.map(postItem).join("\n")}</ul>` : `<p>No posts yet.</p>`}
  <p class="tagbar__empty" hidden>No posts with that topic yet.</p>
</div>`;
  return layout({ title: "Writing | Shariar Kabir", description: SITE.description, canonical: SITE.url + "/blog/", body, jsonLd });
}

function renderSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE.url + "/", lastmod: today, priority: "1.0", changefreq: "monthly" },
    { loc: SITE.url + "/publications", lastmod: today, priority: "0.8", changefreq: "monthly" },
    { loc: SITE.url + "/cv", lastmod: today, priority: "0.7", changefreq: "monthly" },
    { loc: SITE.url + "/blog/", lastmod: posts[0] ? posts[0].date : today, priority: "0.8", changefreq: "weekly" },
    ...posts.map((p) => ({ loc: p.url, lastmod: p.updated || p.date, priority: "0.7", changefreq: "yearly" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
}

function renderFeed(posts) {
  const items = posts.slice(0, 20).map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${p.url}</link>
      <guid isPermaLink="true">${p.url}</guid>
      <pubDate>${new Date(p.date + "T09:00:00Z").toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
      <content:encoded><![CDATA[${p.html}]]></content:encoded>
      ${p.tags.map((t) => `<category>${esc(t)}</category>`).join("")}
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Shariar Kabir | Writing</title>
    <link>${SITE.url}/blog/</link>
    <atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(SITE.description)}</description>
    <language>en-gb</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/* ------------------------------------------------------------------ main */
function build() {
  const t0 = Date.now();
  rm(DIST);
  mkdirp(DIST);

  for (const f of SITE.staticFiles) { const src = path.join(ROOT, f); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f)); }
  for (const d of SITE.staticDirs) { const src = path.join(ROOT, d); if (fs.existsSync(src)) copyDir(src, path.join(DIST, d)); }

  const posts = loadPosts();
  posts.forEach((p, i) => write(path.join("blog", p.slug, "index.html"), renderPost(p, posts[i + 1] || null, posts[i - 1] || null)));
  write(path.join("blog", "index.html"), renderBlogIndex(posts));
  write("sitemap.xml", renderSitemap(posts));
  write("feed.xml", renderFeed(posts));

  const homePath = path.join(DIST, "index.html");
  let home = fs.readFileSync(homePath, "utf8");
  const START = "<!-- BLOG:START", END = "<!-- BLOG:END -->";
  const a = home.indexOf(START), b = home.indexOf(END);
  if (a !== -1 && b !== -1) {
    const startTagEnd = home.indexOf("-->", a) + 3;
    const latest = posts.slice(0, SITE.homepagePosts).map(postItem).join("\n        ");
    home = home.slice(0, startTagEnd) + "\n        " + (latest || "<li>No posts yet.</li>") + "\n        " + home.slice(b);
    fs.writeFileSync(homePath, home);
  }

  console.log(`✔ Built ${posts.length} post(s) → dist/ in ${Date.now() - t0}ms`);
  posts.forEach((p) => console.log(`  • ${p.date}  ${p.path}`));
}

build();
