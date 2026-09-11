---
title: "Overfitting Explained: Your Model Aced the Exam and Failed Life"
date: 2026-08-18
description: "Overfitting explained in plain words: overfitting vs underfitting, data splits, why rising validation loss is the tell, and how regularisation stops it."
tags: [Machine Learning, AI, Deep Learning]
---

Picture a student who memorises every past exam paper, word for word. Hand them last year's paper and they score full marks. Hand them the same question phrased slightly differently and they stare at it as if it were in a language they have never seen.

That student is an overfitted model. It has not learned the subject; it has learned the paper. Machine learning models do this constantly, and with such confidence that the training metrics look wonderful right up until real data arrives.

Overfitting is the most common way a promising model becomes an embarrassing demo, so here is what it is, how to spot it, and how to make it stop.

## Overfitting vs underfitting: two ways to be wrong

Underfitting is the simpler failure. The model is too simple, or trained too little, to capture the pattern at all. It does badly on the training data and badly on everything else: the student who skimmed the textbook once and answers "B" to every question.

Overfitting is the opposite. The model is flexible enough to learn the noise along with the signal: the quirks of the particular examples, the odd mislabelled row. It looks brilliant on training data and falls apart on anything new.

| | Training error | New-data error | Diagnosis |
|---|---|---|---|
| Underfitting | High | High | Too simple, learned too little |
| Just right | Low | Low, slightly higher | Learned the pattern |
| Overfitting | Very low | High | Learned the noise |

The gap between the two error columns is the entire story. A small gap is healthy. A chasm means the model has a photographic memory and no understanding, which is also a fair description of [a toddler with a dataset](/blog/ml-models-are-like-toddlers/).

## Train, validation and test splits

You cannot grade a model on the data it learned from, for the same reason you cannot grade a student on the answer sheet. So the data gets split three ways:

- Training set: what the model learns from.
- Validation set: what you use for decisions such as model size, learning rate, and when to stop.
- Test set: touched once, at the very end, for an honest number.

The classic mistake is to peek at the test set repeatedly, tweaking until the score looks good. At that point it has quietly become a slow validation set and the honest number is gone. The second classic mistake is leakage: duplicate records, the same patient in two splits, a timestamp that gives the answer away. Leakage produces spectacular results, and spectacular results are usually the first symptom.

## Why validation loss going up is the tell

During training, plot two curves: loss on the training set and loss on the validation set. Early on, both fall. Then the training loss keeps falling while the validation loss bottoms out and starts creeping back up.

That divergence is the signature of overfitting. The model is still "improving" on the paper it memorised and getting worse at everything else. When training accuracy reads 99 percent and validation accuracy is sliding, stop admiring the first number.

```python
best, patience = float("inf"), 0
for epoch in range(max_epochs):
    train_one_epoch(model, train_loader)
    val_loss = evaluate(model, val_loader)
    if val_loss < best:
        best, patience = val_loss, 0
        save_checkpoint(model)
    else:
        patience += 1
        if patience >= 5:
            break  # early stopping
```

Ten lines, and they have saved more projects than any architecture paper.

## Regularisation in plain words: dropout, weight decay, early stopping, more data

Regularisation is the umbrella term for anything that makes a model less able to memorise.

- **Dropout** randomly switches off a fraction of the neurons on each training step, so no single neuron can become the one that remembers example 4,217. It is revising with a random third of your notes hidden: you are forced to learn the idea, not the page.
- **Weight decay** adds a penalty for large weights. Large weights are how a network builds elaborate special cases, so the penalty is a tax on over-confidence.
- **Early stopping** is the code above: stop when validation loss stops improving. The cheapest fix and, embarrassingly often, the most effective.
- **More data** is the boring answer that works best. Memorising a million examples is much harder than memorising a thousand. When you cannot collect more, augmentation (flipping, cropping, adding noise) manufactures variety, and [transfer learning](/blog/transfer-learning-explained/) borrows from a model that already saw the million.

## The cross-validation habit

A single split can lie. Draw a lucky validation set and the model looks better than it is; draw an unlucky one and you bin a good model. K-fold cross-validation splits the data into k parts, trains on k minus one, validates on the remainder, rotates, and averages.

It costs k times the compute and buys a score with a spread around it, which is the difference between "91 percent" and "91 percent, once". Small datasets and model selection: non-negotiable. Enormous datasets: a single held-out set is usually fine, because a set that size is hard to get lucky with.

In [AI and cybersecurity research](/#research), a surprising share of the interesting work is checking whether a published number survives a different split. A depressing share does not.

## What to remember

- Overfitting: great on training data, poor on new data. Underfitting: poor on both.
- Split your data three ways, and touch the test set once.
- Validation loss rising while training loss falls is the alarm bell. Trust it.
- Dropout, weight decay and early stopping make memorising harder; more data makes it hardest.
- Cross-validate whenever the dataset is small enough that one split might be lucky.

A model that scores 100 percent on its training data has not achieved perfection, it has achieved a photographic memory, and nobody hired it for its memory.
