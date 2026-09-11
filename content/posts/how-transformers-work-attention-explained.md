---
title: "How Transformers Work: Attention Explained for Busy People"
date: 2026-05-26
description: "How transformers work, without the maths: tokens, embeddings, attention with queries, keys and values, multi-head attention, and why it costs so much."
tags: [AI, Deep Learning, Machine Learning]
---

Picture a team that has decided, after one impressive demo, that "the transformer" is a single magic box and that the correct response to any problem is to buy a bigger one. Nobody in the room can say what attention is, but everybody agrees it is the important part.

That is roughly where most conversations about how transformers work begin and end. The architecture behind nearly every large language model is a handful of simple ideas stacked very high, and the height of the stack is what makes it look like magic. Here is the short version, with no equations.

## Tokens and embeddings: turning text into numbers

A model cannot read; it can only multiply numbers, so the first job is turning text into numbers.

Text is chopped into tokens: short chunks that are usually whole words but often fragments ("trans", "form", "er"). Each token is swapped for an embedding, a long list of numbers that acts as the token's coordinates in a space where similar meanings sit close together. "Cat" and "kitten" end up near each other; "cat" and "spreadsheet" do not, unless the training data was mostly about office pets.

## Why attention beats reading left to right

Older sequence models read one token at a time and carried a running summary forward, like someone reading a novel while remembering it through a single, ever-fuzzier sticky note. By page 300, the name from chapter one is gone.

Attention throws away the sticky note. Every token looks at every other token directly and decides which ones matter for its own meaning. The word "it" in "the server crashed because it ran out of memory" can look straight at "server" and take what it needs.

All of this happens in parallel, the whole sentence at once, which is exactly what a GPU is good at and the sticky-note approach never could.

## Queries, keys and values, without the maths

Each token produces three things from its embedding:

| Piece | What it represents | Plain analogy |
|---|---|---|
| Query | What this token is looking for | The question typed into a search box |
| Key | What this token can be matched on | The title of each document in the library |
| Value | What this token hands over if matched | The document itself |

Every query is compared with every key, the scores become weights that add up to one, and each token receives a blend of the values weighted by how well their keys matched. That blend is the token's new, context-aware representation.

The one intuition worth keeping: attention is a soft lookup. Instead of fetching one exact result, it fetches a little of everything, mostly from the entries that matched best.

## Multi-head attention and positional information

One lookup per token is narrow: a word might need its subject for grammar and something three sentences back for tone. So the model runs several lookups side by side, each with its own queries, keys and values, and stitches the results together. These are the heads.

There is an embarrassing gap: because every token looks at every other at once, the model has no idea what order they came in. "Dog bites man" and "man bites dog" produce the same bag of vectors. The fix is to add positional information to each embedding, a pattern that encodes "you are token number 7". Without it, the most expensive architecture in computing is a very good word-shuffler. Stack these blocks dozens of times and that is a transformer.

## Why transformers scale, and what the bill looks like

The architecture won because every part of it is a large matrix multiplication, the one thing hardware vendors have spent two decades making cheap. Add layers, heads and data, and performance keeps improving in a way older architectures did not, which is a powerful property in a field that enjoys spending other people's money.

The bill arrives in two forms. First, attention is quadratic: every token compares itself with every other token, so doubling the input length quadruples the attention work. Second, the model keeps the keys and values for the whole context so it can refer back, which is why long conversations eat memory faster than a browser with forty tabs open.

This matters for security too. A model that attends to everything in its context will happily attend to instructions an attacker smuggled into a pasted document, which is why [prompt injection tops the OWASP list for LLM applications](/blog/llm-security-owasp-top-10/). Attention does not know which tokens are trustworthy, only which ones match, which is why it keeps turning up in [my research area](/#research).

## What to remember

- Tokens are chunks of text; embeddings turn them into vectors where similar meanings sit close together.
- Attention lets every token look at every other token directly and in parallel, with no fading summary.
- Queries, keys and values form a soft lookup: ask, match, then blend the answers by match quality.
- Heads run several lookups side by side; positional information tells the model what order the words came in.
- Transformers scale because they are all matrix multiplication, and cost quadratically in context length.

Now you understand the architecture behind the chatbot that confidently told you the wrong capital of Australia, which is a small comfort, but a comfort nonetheless.
