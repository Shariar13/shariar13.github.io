---
title: "Accuracy vs Precision vs Recall: Why Accuracy Lies to You"
date: 2026-06-30
description: "Accuracy vs precision vs recall explained with a confusion matrix: why 99% accuracy can be useless, what F1 measures, and when each metric matters."
tags: [Machine Learning, AI, Education]
---

Picture a fraud detector that has just been demonstrated to a room of executives. It scores 99% accuracy. Applause. Someone mentions a bonus. Nobody asks how many fraudulent transactions it caught.

The answer is none. It flags nothing, ever. Since roughly 1% of transactions are fraudulent, a model that always says "legitimate" is right 99% of the time. It is also a rock, and the rock did not need a GPU.

This is the accuracy vs precision vs recall problem. The metric was fine. It was just answering a question nobody asked.

## Why 99% accuracy can be useless on imbalanced data

Accuracy is the fraction of predictions that were correct. On balanced data it is a reasonable summary. On imbalanced data, where one class is rare, it mostly measures how rare the rare class is.

Here is a confusion matrix for 10,000 transactions, 100 of them fraudulent, scored by a slightly less lazy model than the rock:

| | Predicted fraud | Predicted legitimate |
|---|---|---|
| **Actually fraud** | 20 (true positive) | 80 (false negative) |
| **Actually legitimate** | 30 (false positive) | 9,870 (true negative) |

Accuracy: (20 + 9,870) / 10,000 = 98.9%. Lovely. Meanwhile the model missed 80 of the 100 frauds. Nearly all of that 98.9% is the model correctly not panicking about normal purchases, the easy part of the job.

## Precision and recall, defined without tears

**Precision** asks: of everything the model flagged, how much was real? It is TP / (TP + FP). In the table, 20 / (20 + 30) = 40%. Six in ten alerts are false alarms, and someone has to phone those customers.

**Recall** asks: of everything that was real, how much did the model catch? It is TP / (TP + FN). Here, 20 / (20 + 80) = 20%. Four in five frauds walk straight through.

A memory aid: precision is the cost of crying wolf, recall is the cost of missing the wolf. Accuracy is how many sheep there were.

**F1 score** is the harmonic mean of precision and recall, 2PR / (P + R). It punishes imbalance, so perfect precision cannot rescue terrible recall. For the table, F1 is roughly 0.27, which sounds about as bad as it is. Use it when both errors matter about equally, and admit that "equally" is an assumption.

## When precision matters and when recall matters

The right metric depends on which mistake hurts more, which is a business or ethical question, not a statistical one.

- **Medical screening:** recall. Missing a disease is far worse than an extra test; the follow-up test handles the false alarms.
- **Spam filtering:** precision. Spam in the inbox is annoying; a job offer in the spam folder is a small tragedy. Users never forgive a filter that eats real mail.
- **Fraud detection:** both, awkwardly. Missed fraud costs money; false alarms cost customers and analyst time. Most teams fix a precision floor the analysts can tolerate and maximise recall under it.
- **Intrusion detection:** recall for what you cannot miss, precision so alerts get read; the [intrusion detection post](/blog/machine-learning-intrusion-detection/) covers alert fatigue.

If a metric was chosen without anyone saying which error is worse, it was chosen because it looked best on the slide.

## The precision-recall trade-off and the threshold nobody mentions

Most classifiers do not output "fraud" or "not fraud". They output a score, say 0.73, and somebody picks a threshold, usually 0.5, usually by not thinking about it.

Lower the threshold and the model flags more: recall rises, precision falls. Raise it and precision rises, recall falls. The same model can be a paranoid alarm or a sleepy guard, depending on one number that is usually left at its default like a router password.

So "85% precision" is meaningless on its own. At what threshold? At what recall? Report a precision-recall curve or a few operating points, and pick the threshold from your requirements, not the library default.

## Always report the base rate

The base rate is the proportion of the positive class in the data. It is the one number that makes every other metric interpretable, and the one most often missing from the write-up.

Without it, nobody can tell whether 95% accuracy is impressive or whether the rock would have got 94%. It is like reporting a temperature without the unit, then looking hurt when people ask.

Report it with the majority-class baseline and the numbers stop lying. If they still look too good, check that the test set is not [leaking the answer](/blog/data-leakage-in-machine-learning/), the other way to get a perfect score for nothing.

## What to remember

- Accuracy on imbalanced data mostly measures class imbalance. A do-nothing model can score 99%.
- Precision: how many alerts were real. Recall: how many real cases were caught. F1 balances them.
- Pick the metric by asking which error costs more: recall for screening, precision for spam, a negotiated mix for fraud and security.
- Precision and recall trade off through the decision threshold. Report operating points, not one magic number.
- Always state the base rate and the majority-class baseline. Otherwise the reader cannot tell your model from a rock.

Much of the evaluation work in [my research area](/#research) is exactly this: arguing about which mistake is cheaper before arguing about which model is better.

The rock, for the record, has been promoted to Head of Analytics, where its accuracy remains excellent.
