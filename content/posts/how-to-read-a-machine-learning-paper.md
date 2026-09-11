---
title: "How to Read a Machine Learning Paper Without Being Fooled"
date: 2026-06-16
description: "How to read a machine learning paper efficiently and critically: the three-pass method, baselines, leakage, ablations, red flags and a checklist to keep."
tags: [Research, Machine Learning, AI, Education]
---

Every machine learning paper I have ever read is novel. I know this because it says so in the abstract, usually twice, and once more in the conclusion in case the novelty wore off during the experiments. Every method is also state-of-the-art, on a benchmark chosen after the results came in, against baselines tuned by someone who wanted them to lose.

I say this with affection, because I have written that abstract. Everyone has. The incentives that produce a paper are not the incentives that produce a reliable claim, and reading a paper well means separating what was shown from what was said.

This post is how I read a machine learning paper now: a three-pass method for speed, a list of things to actually check for rigour, the red flags that make me put a paper down, and a note-taking habit that means I do not have to read it again next month.

## Why "novel" and "state-of-the-art" tell you nothing

"Novel" is a required word. Reviewers ask for it, so authors supply it. It means "we could not find this exact combination in the related work we searched", which is a statement about the search. "State-of-the-art" means "the best number in our table", which is a statement about the table. Neither is a lie. Neither is evidence.

The useful questions are narrower. What was the previous best, under the same conditions, and by how much is this better? Is that gap larger than the run-to-run variation of the method? Would the improvement survive a fair baseline? The rest of this post is about answering those, and it starts with not reading the whole paper.

## The three-pass method for reading a paper

The three-pass approach is the standard advice for reading research papers, and it works because most papers do not deserve a full read on the first encounter.

**Pass one: five to ten minutes.** Title, abstract, introduction, section headings, figures, conclusion. Skip everything else. You are answering: what problem, what claim, what kind of evidence, and do I care? Most papers end here, which is fine. The point of the pass is to find out cheaply.

**Pass two: up to an hour.** Read the whole thing, but skip proofs and implementation minutiae. Look hard at every figure and table: axes, error bars, what is missing. Note the references you do not know. At the end you should be able to explain the method and the main result to someone else, and say what you are not convinced by.

**Pass three: several hours.** Reconstruct the paper. Re-derive the method from the description, and try to reimplement or reproduce a figure. This is where the missing details surface, and it is reserved for papers you are building on, reviewing or trying to beat.

The first pass is for filtering. The second is where the critical reading below happens. The third is for the handful of papers that matter to you personally.

## What to check on the second pass

Here is the list I actually work through. It is the same list I wish reviewers had used on my early [publications](/#publications).

- **Baselines.** Are they the strongest published methods, run under the same conditions, with the same tuning effort? A method that beats a three-year-old baseline trained with default settings has beaten a straw man. Check whether the baseline numbers are copied from another paper with a different setup.
- **Test-set leakage.** Was the test set touched during development? Hyperparameters chosen on the test set, near-duplicates across splits, pretraining data that contains the benchmark. Leakage produces excellent numbers that vanish on new data, exactly as in the [class imbalance post](/blog/how-i-taught-my-neural-network-to-fear-cats/).
- **Ablations.** If the method has four components, is there a table removing each one? Without it you cannot tell which part works, and often the honest answer is "the bigger backbone".
- **Variance.** How many seeds? Are there error bars or standard deviations? A single-run improvement of half a point on a small dataset is indistinguishable from luck.
- **Compute.** How many GPU-hours went into the result, and into the baselines? A method that is better because it trained ten times longer is a different claim from a method that is better.
- **Code and data.** Is there a link, does it run, and does it match the paper? "Code will be released" in a paper from three years ago is itself a data point.
- **Threat model and evaluation scope.** For anything security-flavoured, which attacks were evaluated and were they adaptive? A defence tested only against FGSM, as the [adversarial examples post](/blog/adversarial-examples-fooling-image-classifiers/) explains, has been tested against the weakest attack available.

## Claims versus evidence

The single most useful habit is to write down, in one sentence each, what the paper claims and what the experiments actually demonstrate, and then compare the two sentences.

Claims drift upward between the results section and the abstract. "Outperforms baselines on two of the four datasets" becomes "consistently outperforms". "Competitive on one benchmark at a higher resolution" becomes "state-of-the-art". A robustness result against one attack becomes "robust". Nobody intends to mislead; abstracts are written last, in a hurry, by people who have spent a year hoping. Your job is to read the results table as if the abstract did not exist.

Some translations that hold up disturbingly often:

| Phrase in the paper | What it usually means |
|---|---|
| "Novel" | Not found in the papers we cited |
| "State-of-the-art" | Best number in our table |
| "Significantly better" | Larger, possibly with a p-value, possibly not |
| "Competitive with" | Worse than |
| "We leave X to future work" | X did not work |
| "Due to space constraints" | The ablation was unflattering |
| "Code will be released" | Ask again in two years |

## Red flags: the checklist

This is the table I keep in my notes template. A single flag is normal. Three or more and the paper goes in the "interesting if true" pile.

| Check | Red flag | Why it matters |
|---|---|---|
| Baselines | Copied from other papers, untuned, or years old | Comparison is not like-for-like |
| Test set | Used for model selection, or no separate validation split | Numbers will not transfer |
| Seeds | One run, no error bars | Gap may be noise |
| Ablation | Missing, or only on a toy dataset | Cannot tell what works |
| Compute | Not reported, or wildly unequal to baselines | Improvement may be budget |
| Code | Absent, or does not reproduce the table | Cannot verify anything |
| Datasets | Only the ones where the method wins | Cherry-picked evidence |
| Metrics | Accuracy only, on imbalanced data | Hides minority-class failure |
| Claims | Abstract stronger than results | Read the table, not the summary |
| Limitations | Absent, or one sentence of boilerplate | Nobody looked hard for failure modes |

## Keeping notes that survive a month

The waste in reading papers is reading them twice. I keep one note per paper with a fixed shape: full citation, one-sentence claim, one-sentence evidence, the checklist above with flags marked, three bullet points of what I would borrow, and one line on whether I trust it. It takes ten minutes after the second pass, and it means that six months later, when I need the paper, I get the verdict rather than the PDF.

Tag the notes by topic rather than by venue. The venue is where the paper was accepted; the topic is why you will look for it again.

## Reproducing a figure

The third pass earns its cost when you reproduce one figure. Not the whole paper, one figure, ideally the one the headline claim rests on. Download the code if it exists, or reimplement the smallest experiment if it does not, and see whether you get the same curve.

Three things can happen. It reproduces, and you now trust the paper more than any amount of reading would justify. It reproduces only with an undocumented setting you found in the code, which tells you exactly how sensitive the result is. Or it does not reproduce at all, and you have saved yourself from building on it. All three outcomes are worth the afternoon. A method that only works in the authors' hands is not yet a method; it is an anecdote with a LaTeX template.

## What to remember

- "Novel" and "state-of-the-art" are required vocabulary, not evidence. Read the table.
- Use three passes: skim to filter, read to understand, reproduce to trust.
- Check baselines, leakage, ablations, seeds, compute and code before believing a number.
- Write the claim and the evidence as two sentences and compare them.
- Keep a fixed-shape note per paper so you never read it twice.
- Reproduce one figure from any paper you intend to build on.

## Further reading

- [How to Read a Paper, S. Keshav](https://web.stanford.edu/class/ee384m/Handouts/HowtoReadPaper.pdf), the original three-pass method.
- [NeurIPS paper checklist](https://neurips.cc/public/guides/PaperChecklist) for what the authors were supposed to disclose.
- [The Machine Learning Reproducibility Checklist](https://www.cs.mcgill.ca/~jpineau/ReproducibilityChecklist.pdf) for the reproducibility side.

And if the paper you are reading is one of mine, please apply every row of that table and then email me. I would rather hear it from you than from reviewer two.
