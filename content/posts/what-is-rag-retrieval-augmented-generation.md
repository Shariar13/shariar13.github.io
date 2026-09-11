---
title: "What Is RAG? Retrieval-Augmented Generation Without the Hype"
date: 2026-09-01
description: "What RAG (retrieval-augmented generation) actually does, why LLMs hallucinate without it, how chunking and embeddings work, and where RAG quietly fails."
tags: [AI, Machine Learning]
---

Picture a company that spends a small fortune on a chatbot for its internal documentation. On launch day someone asks it about the holiday policy. It answers, confidently and politely, with a policy that does not exist. The model made it up, because that is what it does when it has nothing better to go on.

Retrieval-augmented generation, RAG for short, is the fix everyone reaches for. It is also the most over-sold three letters in the industry right now, so here is what RAG actually is, what it fixes, and where it quietly falls over.

The short version: instead of asking the model to remember, you hand it the relevant notes and ask it to read.

## Why LLMs hallucinate without retrieval

A large language model is a very good next-word predictor trained on a frozen snapshot of text. Two things follow. It knows nothing that happened after its training cut-off, and nothing that was never public: your internal wiki, your contracts, last Tuesday's incident report. And it has no built-in sense of "I don't know". When it lacks the fact, it produces the most plausible-sounding sentence anyway, and plausible is precisely the problem.

Hallucination is not a bug in the usual sense. It is the default behaviour of a system built to produce fluent text rather than verified text.

## The retrieve-then-generate loop

RAG bolts a search step onto the front of the model:

1. The user asks a question.
2. The system searches a document store for the passages most relevant to it.
3. Those passages go into the prompt next to the question, with an instruction such as "answer using only the context below".
4. The model generates an answer grounded in what it was given.

No new model, no magic. The "augmented" part is a well-timed copy and paste. The clever engineering lives entirely in step 2, which is why teams that treat retrieval as an afterthought end up with a very expensive random-sentence generator.

## Chunking and embeddings in plain words

You cannot paste a 400-page manual into every prompt, so documents are split into chunks: a few hundred words each, ideally along natural boundaries such as headings or paragraphs. Chunk too small and you lose context; chunk too large and you drown the relevant sentence in noise.

Each chunk is then turned into an embedding, a long list of numbers that captures roughly what the text is about. Texts with similar meaning get similar numbers, so "annual leave entitlement" and "how many holidays do I get" land close together despite sharing no words. At query time the question gets the same treatment and the system pulls the nearest neighbours.

```python
query_vec = embed("how many holidays do I get?")
hits = index.search(query_vec, top_k=5)
context = "\n\n".join(chunk.text for chunk in hits)
answer = llm(f"Answer using only this context:\n{context}\n\nQuestion: {question}")
```

Four lines. The other four thousand are for cleaning the documents.

## Where RAG fails: bad retrieval, stale index, prompt stuffing

RAG shifts the failure modes; it does not abolish them.

| Failure | What it looks like | Usual cause |
|---|---|---|
| Bad retrieval | Confident answer built on the wrong passage | Poor chunking, weak embeddings, vague questions |
| Stale index | Last year's policy, delivered with today's date | Nobody re-indexed after the documents changed |
| Prompt stuffing | Slow, expensive, and somehow still wrong | Top-50 chunks shoved in "to be safe" |

The stale index is the sneaky one. The pipeline still runs, the answers still sound grounded, and the grounding is simply out of date. A RAG system is only as current as its last re-index, which is a maintenance job, and maintenance jobs are where good intentions go to retire.

Prompt stuffing deserves its own sigh. More context is not more accuracy; models get distracted by irrelevant passages and the one useful chunk gets lost in the middle. Retrieve less, retrieve better.

And a security note: if the document store contains text an attacker could have written, they can plant instructions the model will happily follow. The [OWASP Top 10 for LLM applications](/blog/llm-security-owasp-top-10/) files that under prompt injection, and RAG makes it a daily concern.

## When fine-tuning is the wrong answer

The classic mistake is to hear "the model doesn't know our data" and reach for fine-tuning. Fine-tuning teaches a model style, format and behaviour. It is a poor way to teach it facts, and a terrible way to teach it facts that change: you would be retraining every time a document is edited, and you still could not point at where an answer came from.

- Needs to know things: RAG.
- Needs to sound a certain way or follow a rigid format: fine-tuning.
- Needs both: RAG first, fine-tune later, if ever.

Retrieval also gives you citations. When the answer is wrong, you can see which chunk misled it, fix the document, and move on. In my opinion that auditability is the real reason to use RAG, and in [AI and cybersecurity research](/#research) it is the part that matters most, because "the model said so" is not evidence.

## What to remember

- RAG means: search for relevant text first, then let the model answer from it.
- LLMs hallucinate by design; retrieval reduces it, nothing removes it.
- Chunking and embeddings decide whether retrieval finds the right passage. Spend your effort there.
- A stale index fails silently. Re-index on a schedule, not on a complaint.
- Fine-tuning changes how a model talks, not what it knows. Use RAG for facts.

Give the model the notes, keep the notes current, and if it still invents a holiday policy, at least you will know exactly which paragraph to blame.
