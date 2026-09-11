#!/usr/bin/env node
// Create a new blog post:  npm run new -- "My post title"
const fs = require("fs"), path = require("path");
const title = process.argv.slice(2).join(" ").trim();
if (!title) { console.error('Usage: npm run new -- "Post title"'); process.exit(1); }
const slug = title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const date = new Date().toISOString().slice(0, 10);
const file = path.join(__dirname, "..", "content", "posts", `${slug}.md`);
if (fs.existsSync(file)) { console.error(`Already exists: ${file}`); process.exit(1); }
fs.writeFileSync(file, `---
title: "${title.replace(/"/g, '\\"')}"
date: ${date}
description: "One or two sentences that appear in search results and social previews."
tags: [AI, Cybersecurity]
draft: true
---

Write your post here in **Markdown**. Remove \`draft: true\` when it's ready to publish.

## A heading

Some text, a [link](https://example.com), and a code block:

\`\`\`python
print("hello")
\`\`\`
`);
console.log(`Created ${path.relative(process.cwd(), file)}`);
