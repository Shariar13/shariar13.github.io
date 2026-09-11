---
title: "How I Taught My Neural Network to Fear Cats: Class Imbalance"
date: 2026-02-10
description: "Why accuracy lies on imbalanced data, and how to fix class imbalance in image classification with confusion matrices, class weights and stratified splits."
tags: [Machine Learning, Deep Learning, Computer Vision, AI]
---

Years ago I built a cat-versus-dog classifier as a weekend project. The training set had 800 images of cats, most of them visibly furious, and 12 images of dogs, because that was what my hard drive contained. The model reported 98.5% accuracy on the held-out set. I told people about it. I was proud.

Then I showed it a golden retriever and it said "cat" with 99% confidence. I showed it a labrador. Cat. A photo of my own face. Cat, and slightly less confident, which I am choosing not to think about.

The model had not learned what a dog looked like. It had learned that the answer is always "cat", and my evaluation had agreed with it. This post is about class imbalance and dataset bias in image classification: why accuracy lies, what to measure instead, and how to stop your network from arresting Garfield.

## Why accuracy lies on an imbalanced dataset

Accuracy is the fraction of predictions that were correct. On a balanced dataset that is a reasonable summary. On an imbalanced one it is a trap, because the majority class sets a floor that a model can reach without learning anything.

With 800 cats and 12 dogs, a model that says "cat" every time is right 800 times out of 812, which is 98.5%. Nobody looks at 98.5% and thinks "this model is broken". It is only when you ask what happened to the dogs that the number falls apart.

The same failure shows up in every domain where the interesting class is rare: fraudulent transactions, tumours on scans, intrusions in network traffic. The thing you actually care about is the minority, and the metric you chose does not care about the minority at all.

## Reading the confusion matrix

The first fix is not a new model. It is a table. A confusion matrix counts predictions against true labels, one row per real class, one column per predicted class. Mine looked like this on a validation set of 200 cats and 3 dogs:

| | Predicted cat | Predicted dog |
|---|---|---|
| Actual cat | 200 | 0 |
| Actual dog | 3 | 0 |

That right-hand column is the whole story. Zero dogs predicted. Accuracy 98.5%, exactly as promised, and completely useless.

Generating one takes two lines in scikit-learn, and I recommend printing it every single time you evaluate a classifier, before you look at any summary number:

```python
from sklearn.metrics import confusion_matrix, classification_report

print(confusion_matrix(y_true, y_pred, labels=[0, 1]))
print(classification_report(y_true, y_pred, target_names=["cat", "dog"]))
```

## Precision, recall and F1: the metrics that notice the dogs

The confusion matrix has four cells, and three metrics fall out of it for any class you care about:

- **Precision**: of everything the model called "dog", what fraction really was a dog? Measures false alarms.
- **Recall**: of all the real dogs, what fraction did the model find? Measures misses.
- **F1 score**: the harmonic mean of the two. It is low if either is low, which is the point.

For my dog class: precision undefined (no predictions), recall 0, F1 0. Report those alongside accuracy and nobody is fooled. The `classification_report` above prints them per class, plus a **macro average** that weights each class equally regardless of size. Macro F1 is usually the number to optimise on imbalanced data, because it refuses to let 800 cats drown out 12 dogs.

## Class weights: making every dog count

If you cannot change the data, change the loss. Class weighting multiplies the loss for each example by a factor inversely proportional to how common its class is. A misclassified dog then costs the model roughly 67 times more than a misclassified cat, and gradient descent finally has a reason to care.

In PyTorch it is one argument:

```python
import torch
import torch.nn as nn

counts = torch.tensor([800.0, 12.0])             # cats, dogs
weights = counts.sum() / (len(counts) * counts)  # inverse frequency, normalised
criterion = nn.CrossEntropyLoss(weight=weights)
```

Scikit-learn does the same via `class_weight="balanced"` on most classifiers. Two caveats. Very aggressive weights make training noisier, because a handful of examples now dominate each batch. And weighting fixes the incentive, not the information: 12 dogs is still 12 dogs, and the model can only learn what those 12 show it.

## Oversampling, SMOTE and why images are awkward

The other lever is resampling. **Undersampling** throws away majority examples until the classes balance, which wastes data. **Oversampling** duplicates minority examples, which is cheap but teaches the model to memorise those specific dogs.

**SMOTE** (Synthetic Minority Over-sampling Technique) is the popular refinement for tabular data: it creates new minority points by interpolating between existing neighbours in feature space. For a spreadsheet of loan applications that is sensible. For raw images it is not. Averaging the pixels of two dogs does not produce a third dog; it produces a translucent ghost dog with eight legs, and you have just added label noise with extra steps. If you want SMOTE-like behaviour for images, apply it to embeddings from a pretrained encoder, not to pixels, and even then treat the results with suspicion.

## Augmentation and stratified splits

For images, the honest form of oversampling is **augmentation**: random flips, crops, rotations, colour jitter and small changes in scale applied on the fly. Each epoch the model sees a slightly different version of each dog, which is far more informative than the same dog 67 times. Augment the minority harder than the majority if you like, but keep the transforms physically plausible. A dog upside down is still a dog; a dog with its colours inverted is a data-entry error.

Then there is the split. If you shuffle 812 images and hold out 20% at random, it is entirely possible to end up with zero dogs in the validation set, at which point your recall is not low, it is undefined. **Stratified splitting** preserves the class ratio in every partition:

```python
from sklearn.model_selection import train_test_split

X_tr, X_val, y_tr, y_val = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)
```

With so few minority examples, stratified k-fold cross-validation is better still, because a single validation split containing 3 dogs tells you almost nothing.

## Data leakage: the other way to fool yourself

Imbalance is what my 98.5% was hiding. Leakage is what would have hidden it even after I fixed the metrics.

Leakage is any way that information from the test set reaches the model during training. Common routes in image work:

1. **Near-duplicates.** The same dog photographed twice, one copy in train and one in test. The model memorises, the test rewards it.
2. **Resampling before splitting.** If you oversample first and then split, the copies of a dog land on both sides of the line. Always split first, resample only the training portion.
3. **Augmentation before splitting.** Same problem, with flips.
4. **Bias that correlates with the label.** All my dog photos were taken outdoors, all the cats indoors. A "dog detector" that has actually learned "grass" will ace the test set and fail on the first dog on a sofa.

That last one is dataset bias rather than leakage in the strict sense, but it fails in the same way: the test score is real and the model is still wrong about the world. The only defence is to look at what the model attends to, and to test on data collected differently from the training set. Small, biased datasets are exactly where [transfer learning](/blog/transfer-learning-explained/) earns its keep, and where the healthcare work on my [research page](/#research) taught me most of the above the hard way.

## What to remember

- Accuracy on an imbalanced dataset mostly measures how imbalanced it is. Print the confusion matrix first.
- Report per-class precision, recall and F1, and optimise macro F1 when the minority class matters.
- Class weights fix the incentive cheaply, but cannot invent information that 12 examples do not contain.
- SMOTE interpolates features; on raw pixels that produces ghost dogs. Use augmentation for images instead.
- Split with stratification, and do it before any resampling or augmentation.
- A high test score on a biased dataset is still a wrong model. Test on data gathered differently.

## Further reading

- [scikit-learn: Metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html) for the definitions behind the classification report.
- [PyTorch: CrossEntropyLoss](https://pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html) for the `weight` argument and its exact semantics.
- [scikit-learn: Cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html) for stratified splitting and k-fold.

The classifier has since been retired. Its final act was to label a photo of my neighbour's dog as "cat, 94%", which my neighbour's cat presumably found flattering. If you want to know why the retrained version then refused to converge at all, that is the [toddler post](/blog/ml-models-are-like-toddlers/).
