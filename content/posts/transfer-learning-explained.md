---
title: "Transfer Learning Explained: Fine-Tuning CNNs on Small Datasets"
date: 2026-04-07
description: "Transfer learning explained: how to fine-tune ImageNet-pretrained CNNs on small datasets, which layers to freeze, and when domain shift breaks it."
tags: [Machine Learning, Deep Learning, Computer Vision, Research]
---

Somebody once asked me how many images you need to train an image classifier. I said "a few thousand per class", because that is what the textbooks implied and I had not yet tried it with fewer. Then I was handed a dataset of medicinal plant leaves, photographed by hand, a few hundred images in total, and a deadline.

Training a convolutional network from scratch on that would have produced a model that recognised the specific patio the photos were taken on. What worked instead was borrowing a network that had already spent weeks learning what edges, textures and shapes look like on a million ordinary photographs, and teaching it only the last bit: which leaf is which.

That is transfer learning, and it is the single most useful trick I know for small datasets. My earlier research used transfer learning to identify medicinal plant leaves and to classify skin disease from small datasets, both of which are on my [publications page](/#publications). This post explains what is being transferred, how to fine-tune without wrecking it, and when it quietly fails.

## What transfer learning actually transfers

A CNN trained on ImageNet, a dataset of over a million labelled photos across a thousand everyday categories, does not just learn "golden retriever" and "espresso". Its early layers learn general-purpose filters: edge detectors, colour blobs, oriented gradients. The middle layers combine those into textures and parts. Only the final layers are specific to the thousand ImageNet classes.

Those early and middle layers are useful for almost any natural-image task, because leaves and rashes and X-rays are also made of edges and textures. Transfer learning keeps that learned hierarchy and replaces the task-specific head. You start from features that already work rather than from random noise, which is why a few hundred images can be enough.

Architectures such as ResNet50 and VGG16 are the standard starting points, not because they are the newest but because pretrained weights are one line away in every framework and their behaviour is well understood. Newer backbones transfer too; the recipe is the same.

## Feature extraction versus fine-tuning

There are two ways to use a pretrained backbone, and the difference is how much of it you let change.

**Feature extraction** freezes the entire backbone. You pass each image through it once, take the vector that comes out just before the old classification layer (2048 numbers for ResNet50), and train a new small classifier on those vectors. Nothing in the backbone learns. It is fast, it cannot overfit the backbone because the backbone is not training, and on a very small dataset it is often all you need. You can even cache the feature vectors and train the head with scikit-learn in seconds.

**Fine-tuning** unfreezes some or all of the backbone and trains it, gently, together with the new head. The pretrained weights are the starting point rather than a fixed feature map. This adapts the features to your domain, which matters more the further your images are from ordinary photographs, but it costs more compute and it can overfit if you let too much change with too little data.

The usual progression is: try feature extraction first, and if the validation results plateau, unfreeze the top block or two and fine-tune.

## Which layers to freeze

The rule of thumb follows the layer hierarchy. Early layers are generic, so keep them frozen. Late layers are task-specific, so let them train. The dial in between depends on two things: how much data you have and how far your domain is from ImageNet.

| Dataset size | Similar to ImageNet | Very different from ImageNet |
|---|---|---|
| Small (hundreds) | Freeze all, train head | Freeze early layers, fine-tune last block |
| Medium (thousands) | Fine-tune last block or two | Fine-tune most of the network |
| Large (tens of thousands) | Fine-tune everything | Fine-tune everything, or consider training from scratch |

For the plant leaves, which are ordinary colour photographs of natural objects, freezing almost everything was the sensible starting point. Skin lesion images are further from ImageNet, closer up and with less context, and justified unfreezing more.

One practical detail: batch normalisation layers in the backbone carry running statistics from ImageNet. When you fine-tune on a small dataset with small batches, updating those statistics can destabilise training. Many people keep the batch-norm layers in evaluation mode even while fine-tuning the surrounding weights. If your fine-tuning run is jittery, that is the first thing to check, closely followed by everything in the [toddler post](/blog/ml-models-are-like-toddlers/).

## Learning rates for fine-tuning

The pretrained weights are good. The new head is random. Treating both the same is the classic mistake: a learning rate high enough to train the head from scratch is high enough to trample the backbone's features in the first few hundred steps, at which point you have a badly initialised network and none of the benefit.

Two fixes, usually combined:

1. **Discriminative learning rates.** Give the backbone a learning rate roughly ten to a hundred times smaller than the head. The head learns fast; the backbone drifts slowly.
2. **Train the head first.** Freeze the backbone, train the head for a few epochs until it is sensible, then unfreeze and fine-tune everything at a low rate. The backbone is never exposed to the gradients of a random classifier.

Add a short warm-up and a decaying schedule and you have the standard recipe.

## A minimal PyTorch fine-tuning snippet

```python
import torch
import torch.nn as nn
from torchvision.models import resnet50, ResNet50_Weights

model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)

for param in model.parameters():          # freeze the backbone
    param.requires_grad = False
for param in model.layer4.parameters():   # unfreeze the last residual block
    param.requires_grad = True

model.fc = nn.Linear(model.fc.in_features, num_classes)  # new head, trainable

optimiser = torch.optim.AdamW([
    {"params": model.layer4.parameters(), "lr": 1e-4},
    {"params": model.fc.parameters(),     "lr": 1e-3},
], weight_decay=1e-2)
```

Everything else is a normal training loop. Use the preprocessing transforms that ship with the weights (`ResNet50_Weights.IMAGENET1K_V2.transforms()`), because the backbone expects the same resizing and normalisation it was trained with, and a mismatch there is a silent accuracy tax.

## When transfer learning fails: domain shift

Transfer learning assumes that the features useful for ImageNet are useful for your task. When that assumption breaks, so does the method. **Domain shift** is the general name for it: your data comes from a different distribution than the pretraining data, or your test data comes from a different distribution than your training data.

Some ways it shows up:

- **Modality mismatch.** Greyscale medical scans, spectrograms, satellite imagery or microscope slides share little low-level structure with holiday photos. ImageNet features still help a bit, but far less, and fine-tuning more of the network becomes necessary.
- **Capture mismatch.** Training on leaves photographed against white paper and deploying on leaves in a hedge. The model transfers beautifully to the wrong thing: paper.
- **Label shift.** The class proportions at deployment differ from training, which brings back every problem from the [class imbalance post](/blog/how-i-taught-my-neural-network-to-fear-cats/).
- **Shortcut features.** A pretrained backbone is extremely good at finding any signal that separates the classes, including rulers next to lesions, hospital watermarks or the date stamp in the corner. It transfers the ability to cheat as readily as the ability to see.

The diagnosis is the same as always: evaluate on data collected differently from the training set, look at what the model attends to, and be suspicious of any result that arrived too easily.

## What to remember

- Pretrained CNNs transfer generic early features; you replace only the task-specific head.
- Start with feature extraction. Fine-tune the top blocks only if you need to and have the data to afford it.
- Freeze more when the data is small and similar to ImageNet; unfreeze more when it is larger or very different.
- Use a much lower learning rate for the backbone than for the new head, and train the head first.
- Keep the pretrained preprocessing; a normalisation mismatch silently costs accuracy.
- Domain shift is the failure mode. Test on data that does not look like your training set.

## Further reading

- [torchvision: Models and pre-trained weights](https://pytorch.org/vision/stable/models.html) for the available backbones and their preprocessing transforms.
- [Keras: Transfer learning and fine-tuning](https://keras.io/guides/transfer_learning/) for the same recipe in the other framework, including the batch-norm caveat.

The plant classifier is still the fastest I have ever gone from "no data" to "working demo". The skin disease model took longer, mostly because I insisted on learning the learning-rate lesson personally. Next: what happens when someone deliberately changes a few pixels so the leaf becomes a toaster, in the post on [adversarial examples](/blog/adversarial-examples-fooling-image-classifiers/).
