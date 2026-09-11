---
title: "Data Leakage in Machine Learning: The Bug That Makes You Look Brilliant"
date: 2026-07-14
description: "Data leakage in machine learning explained: target leakage, train/test contamination, time-series leaks and duplicates, and how to catch the bug early."
tags: [Machine Learning, AI, Research]
---

Picture a team that trains a model on a Friday afternoon, gets 99.7% accuracy on the test set, and spends the weekend drafting a paper. On Monday somebody asks which features the model relied on. The top one is a column called `claim_paid_amount`. The task was predicting whether an insurance claim would be paid.

That is data leakage in machine learning. The model did not learn anything about insurance. It learned that the answer was already in the spreadsheet, which is a skill I also possess.

Most bugs make your results worse and get fixed. Leakage makes your results better and gets published. It is the only bug that comes with a promotion.

## What data leakage actually is

Data leakage happens when information that would not be available at prediction time sneaks into training. The model performs brilliantly on your evaluation and collapses in production, because the real world rudely refuses to hand over the answer in advance.

The question is not "is this feature in the dataset?" but "would I actually have this value at the moment I need the prediction?". If the answer is no, the feature is leaking, however innocent it looks.

## The classic forms of leakage

Leakage has a small family of recurring shapes. Once you know them, you see them everywhere, which is upsetting.

- **Target leakage.** A feature is a proxy for the label, or computed from it. `number_of_follow_up_appointments` is a wonderful predictor of "patient was diagnosed", because it happens after the diagnosis.
- **Train/test contamination.** The same records, or near-duplicates, appear in both sets. The model memorises them in training and "predicts" them in testing. That is not generalisation, it is recall with extra steps.
- **Preprocessing before splitting.** Scaling, imputing or selecting features on the whole dataset before the split, so test statistics quietly inform training. Feature selection is the worst offender: pick the 50 "best" features using every label, then act surprised.
- **Time-series leakage.** Shuffling time-ordered data into random folds. The model trains on Wednesday and Friday and is tested on Thursday. It is effectively predicting the past, a mature and well-funded field called "history".
- **Duplicate records.** Augmentation, over-sampling or a bad join produces copies. Split randomly and the copies land on both sides of the fence.
- **Group leakage.** Several rows belong to one patient, device or user, and they end up in different folds. The model learns the person, not the pattern.

## Why leaked models look suspiciously perfect

Real problems are noisy. Real labels are sometimes wrong. Real features correlate weakly with outcomes. A genuine model on a hard task gets, say, 80% and everyone is quietly pleased.

A leaked model gets 99%, because the label is sitting in the input wearing a false moustache. Worse, leakage is invisible to your evaluation, because the evaluation is the thing that leaked. Cross-validation does not help if the leak is upstream of the split. Every fold agrees, confidently, that you are a genius.

The tell is that performance does not degrade the way it should. Simple models match complex ones. Removing half the features changes nothing. These are symptoms of a problem that is too easy, and problems are rarely too easy.

## How to catch data leakage before reviewers do

The fix is boring, which is why nobody does it.

**Split first, then touch nothing.** Separate the test set before any scaling, imputation, feature selection or label-aware plotting. Fit the pipeline on the training fold only:

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

pipe = make_pipeline(StandardScaler(), LogisticRegression())
scores = cross_val_score(pipe, X, y, cv=5)  # scaler refitted inside each fold
```

**Interrogate suspicious features.** Ask when each column gets its value. Anything timestamped after the event, anything that sounds like an outcome, anything with an oddly high importance score, gets a hard look. One feature carrying most of the signal is a suspect, not a discovery.

**Respect time and groups.** Use a time-based split for temporal data and a group-aware split for repeated entities. If tomorrow is in the training set, the model is cheating, even if it did not mean to.

**Deduplicate before splitting.** Hash the raw inputs before augmentation. "The same photograph flipped horizontally" is not a fresh test case.

**Run a sanity check.** Train on shuffled labels. If the model still scores well, the pipeline is leaking. Then check the majority-class baseline: if that gets 97%, your 98% is not a result, it is a rounding error, as I argue in [why accuracy lies to you](/blog/accuracy-precision-recall-explained/).

## What to remember

- Leakage is any information at training time that would not exist at prediction time. Ask "when does this value get filled in?" for every feature.
- The classic forms: target proxies, train/test overlap, preprocessing before the split, shuffled time series, duplicates and groups.
- Suspiciously perfect results are a symptom, not an achievement. Hard problems do not give 99%.
- Split first, fit preprocessing inside the pipeline, and use time-aware and group-aware splits.
- Test with shuffled labels and a majority-class baseline. If either looks good, stop and investigate.

For the version where the model generalises, but only to the wrong thing, see [transfer learning](/blog/transfer-learning-explained/); much of [my research area](/#research) involves models that learned the shortcut instead of the lesson.

Leakage is easy to fix; the bad news is that your accuracy will drop to whatever it honestly was, which is a number nobody drafts a paper about on a Friday.
