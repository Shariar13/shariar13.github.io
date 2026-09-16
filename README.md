# shariarkabir.com

Academic profile and writing of Shariar Kabir. Pure static site (HTML/CSS/JS), built with one tiny
Node script, hosted free on **Cloudflare Pages** at the custom domain **shariarkabir.com**.

Design intent: an academic-standard researcher profile (intro with photo and affiliation, numbered sections,
citation-style publication list) with a modern look and a subtle animated network band. Not a marketing site:
no counters, call-to-action buttons or sales copy. Never write other people's names, and never use em dashes.

```
index.html            ← homepage (edit profile content here)
assets/               ← css, js, images (portrait, OG image)
content/posts/*.md    ← blog posts in Markdown  ← add new posts here
build.js              ← renders posts → dist/blog/…, sitemap.xml, feed.xml, injects latest posts into homepage
scripts/new-post.js   ← `npm run new -- "Title"` creates a post file
scripts/serve.js      ← local preview server for dist/
_headers, _redirects  ← Cloudflare Pages config (security headers, old-URL redirects)
dist/                 ← build output (git-ignored, generated)
```

## Run locally

```bash
npm install          # once
npm run dev          # builds and serves http://localhost:8080
```

## Write a blog post

```bash
npm run new -- "My new post title"
# edit content/posts/my-new-post-title.md, remove `draft: true`, then:
npm run build
git add -A && git commit -m "New post" && git push
```

Front matter fields: `title`, `date` (YYYY-MM-DD), `description`, `tags: [A, B]`,
optional `updated`, `image: /assets/img/posts/x.jpg`, `draft: true`, `slug`.
Every post gets its own URL `/blog/<slug>/`, JSON-LD BlogPosting markup, Open Graph tags,
reading time, share buttons, prev/next links, and is added to the sitemap and RSS feed.

## Deploy to Cloudflare Pages (free)

The site is a Cloudflare Pages project named `shariarkabir`, deployed by direct upload (no Git integration).
Custom domains `shariarkabir.com` and `www.shariarkabir.com` are attached; DNS lives in Cloudflare.

Credentials are in `~/.cloudflare-env` (an API token with Cloudflare Pages: Edit and DNS: Edit, plus the
account ID). To publish the current site:

```bash
source ~/.cloudflare-env
npm run deploy        # builds dist/ and uploads it; live in about a minute
```

Commit and push to GitHub as well so the source is backed up (`git add -A && git commit -m "..." && git push`).

## SEO checklist after deploy

- Google Search Console → add property `shariarkabir.com` → submit `https://shariarkabir.com/sitemap.xml`.
- Bing Webmaster Tools → same.
- Update the LinkedIn / GitHub / Google Scholar profile website fields to `https://shariarkabir.com`.
- Test rich results: https://search.google.com/test/rich-results (Person + BlogPosting markup is built in).
- Preview social cards: https://www.opengraph.xyz/

## Blog posts carried over

The six humorous posts from the old site are kept in `content/posts/` but marked `draft: true`, so they
are not published. Delete the `draft` line in any of them to publish it again.

## Things to verify in the content

- Global Talent Visa: stated as a fact, not an award. Two places only: the sidebar chip in index.html and the Work authorisation section in cv.html.
- Publications: all 7 from Google Scholar are listed with authors, venues and DOIs where available. Add new ones as `.pub` items in `index.html`.
- Job title is shown as **Researcher** (user preference; the University portal says Research Assistant). School: **School of Computing, Mathematics and Physics**.
- Experience dates and the Base Camp role description were carried over from the old site.
