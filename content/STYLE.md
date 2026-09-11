# Writing style guide — shariarkabir.com/blog

Author voice: **Shariar Kabir**, Researcher in AI & cybersecurity at the University of Portsmouth.
Works on Zero Trust for 6G (Horizon Europe XTRUST-6G), forensic detection of AI-generated images (DeepGuard),
and a cyber range platform used for university labs (CyberRange.world). Past research: ML for dementia
detection, skin disease, medicinal plant identification (transfer learning).

## Tone

- **Informative first, funny second.** Every joke must sit next to a real explanation. A reader should
  finish knowing how something works, not just amused.
- Dry, self-deprecating, mildly sarcastic. Targets of sarcasm: bad practices, hype, vendors, my own past
  mistakes. Never the reader. Never a named person or company in a defamatory way.
- First person singular. Short paragraphs. Plain words over jargon; define jargon the first time.
- No profanity. No fabricated statistics, benchmarks, quotes or citations. If a number is illustrative,
  say "say" or "roughly". Cite only well-known, real sources (NIST SP 800-207, OWASP Top 10, official docs).
- Do not invent results from my own research. You may mention DeepGuard / CyberRange.world / XTRUST-6G in
  one sentence as context, described exactly as above.
- British spelling (organisation, behaviour, analyse).

## Structure (every post)

1. Front matter (exact format below).
2. Hook: 2–3 short paragraphs. A concrete scene, mistake or absurdity that leads into the topic.
3. 4–7 `##` sections. Headings should be descriptive and contain natural keywords
   ("How PRNU camera fingerprints work", not "The fun part"). Use `###` sparingly.
4. Use at least two of: bulleted list, numbered steps, table, fenced code block. Code must be correct
   and minimal (Python, bash, YAML, Rego, SQL as appropriate). Label the language on the fence.
5. A `## What to remember` section: 4–6 bullet takeaways.
6. Optional `## Further reading`: 2–4 real links (official docs/standards only). No made-up URLs.
7. One closing sentence with a final joke or a nudge to the next post.
8. Length: 1100–1600 words.
9. No `#` H1 in the body (the title is the H1). Start at `##`.

## SEO

- `title`: ≤ 65 characters, contains the main keyword, reads like a real headline. Sarcasm goes in the
  subtitle/description or the body, not by making the title unsearchable.
- `description`: 140–155 characters, contains the keyword, promises the concrete thing the reader learns.
- `tags`: 3–5, Title Case, from this vocabulary where possible: AI, Machine Learning, Deep Learning,
  Cybersecurity, Zero Trust, 6G, Digital Forensics, Deepfakes, Computer Vision, Docker, DevOps, Python,
  Penetration Testing, Cyber Range, Education, Identity, Policy as Code, SIEM, Healthcare AI, Research.
- Internal links: link at least one other post (`/blog/<slug>/`) and one homepage section
  (`/#research`, `/#publications`). Link text should be descriptive.
- Use the main keyword in the first 100 words and in at least one `##` heading. Don't stuff.

## Front matter (exact)

```
---
title: "Title Here"
date: 2026-03-14
description: "One or two sentences, 140–155 chars, with the keyword."
tags: [Cybersecurity, Zero Trust]
---
```

Optional keys: `updated: 2026-05-01`, `image: /assets/img/posts/slug.jpg`, `draft: true`.

## Existing post slugs (for internal links)

deepguard-ai-image-authentication, how-to-spot-ai-generated-images, how-i-taught-my-neural-network-to-fear-cats,
the-day-my-python-script-went-rogue, ai-doesnt-steal-jobs-but-it-might-roast-you,
zero-trust-zero-friends-my-journey-to-cybersecurity-paranoia, when-you-docker-compose-into-chaos,
ml-models-are-like-toddlers, zero-trust-architecture-for-6g-networks, what-is-a-cyber-range,
penetration-testing-methodology-for-beginners, open-policy-agent-rego-tutorial, oauth2-oidc-keycloak-explained,
adversarial-examples-fooling-image-classifiers, transfer-learning-explained, machine-learning-intrusion-detection,
siem-explained-for-developers, docker-security-hardening-checklist, how-to-read-a-machine-learning-paper,
machine-learning-dementia-detection, ai-native-6g-security-threats

## Hard rules (added)

- **No em dashes (—) or spaced en dashes ( – ) anywhere.** Use a comma, colon, full stop or brackets instead.
  En dashes are allowed only inside numeric ranges with no spaces (2019–2023, pp. 401–409).
- **Do not describe the author's own projects.** Most of that work is confidential. Do not name DeepGuard,
  CyberRange.world or XTRUST-6G in posts, and do not describe their architecture, methods, datasets or results.
  Posts must be general: explain the field, not the author's implementation. Personal context is limited to
  "I work on AI and cybersecurity research" or "in my research area".
