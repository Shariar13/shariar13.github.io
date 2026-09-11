---
title: "Adversarial Examples: Fooling Image Classifiers With Noise"
date: 2026-05-12
description: "Adversarial examples explained: FGSM intuition, why tiny perturbations flip predictions, patch attacks, and what the defences mean for deepfake detectors."
tags: [AI, Deep Learning, Cybersecurity, Computer Vision]
---

The first time I saw an adversarial example I assumed the demo was rigged. A photo of a panda, correctly classified as a panda. Add a layer of noise so faint that the two images are indistinguishable to a person, and the same network declares it a gibbon, with more confidence than it had in the panda. That is the famous figure from the paper that introduced the fast gradient sign method, and it is not rigged. It is just what happens when you ask a model the right question in the wrong direction.

I now work on detecting AI-generated images with [DeepGuard](/blog/deepguard-ai-image-authentication/), which means I spend a lot of time thinking about what happens when the thing being detected is allowed to fight back. A classifier that is accurate on ordinary images and useless on images somebody wanted it to misclassify is not a security tool. It is a suggestion.

This post is about adversarial examples: why tiny perturbations flip predictions, how the simplest attack works, why attacks transfer between models, how they escape into the physical world, and what the defences actually buy you.

## Why tiny perturbations flip predictions

The unsettling part is that this is not a bug in one model. It is a consequence of how high-dimensional classifiers behave.

An image is a point in a space with as many dimensions as it has pixel values, several hundred thousand for a modest photo. A classifier draws boundaries through that space. Because the input has so many dimensions, a perturbation that changes each pixel by an imperceptible amount can add up to a large movement in the direction the model cares about. Nudge every pixel by a tiny bit in exactly the direction that increases the "gibbon" score, and the tiny bits sum to a big change in the output, while the picture still looks like a panda.

The original explanation was that deep networks are too linear. Each layer is roughly a linear function of its inputs, and a linear function of many small changes is a large change. Whatever the full story, the practical fact is this: **for most classifiers, and most inputs, there exists a nearby input that the model gets confidently wrong**, and finding it is easy if you know the gradient.

## FGSM: one step uphill

The **Fast Gradient Sign Method** is the hello-world of attacks. Normal training computes the gradient of the loss with respect to the weights and steps downhill to make the loss smaller. FGSM computes the gradient of the loss with respect to the *input image* and steps uphill, to make the loss larger. It takes the sign of each pixel's gradient, so every pixel moves by the same small amount, called epsilon, in whichever direction hurts most.

```python
import torch
import torch.nn.functional as F

def fgsm(model, image, label, eps=0.01):
    image = image.clone().detach().requires_grad_(True)
    loss = F.cross_entropy(model(image), label)
    model.zero_grad()
    loss.backward()
    adversarial = image + eps * image.grad.sign()
    return adversarial.clamp(0, 1).detach()
```

That is the whole attack. One forward pass, one backward pass, one addition. With epsilon of a few thousandths on a 0-to-1 scale, the change is invisible and the prediction flips on a large fraction of images for an undefended model. Iterating the step several times with a smaller epsilon, known as **PGD** (projected gradient descent), is stronger and is the standard benchmark attack.

## Transferability: you do not need the model

FGSM needs the gradient, which means it needs the model's weights. Surely that protects a model hidden behind an API?

It does not, because adversarial examples **transfer**. A perturbation crafted against one model frequently fools a different model trained on similar data, even with a different architecture. Models trained on the same distribution learn similar features and similar boundaries, so the direction that fools one is often a direction that fools another.

The black-box recipe follows directly: train your own substitute model on similar data, or download a public one, craft adversarial examples against it, and send them to the target. Query the target a few times to refine the substitute if you like. Anything built on a shared pretrained backbone, which after the [transfer learning post](/blog/transfer-learning-explained/) is most things, inherits the shared vulnerability along with the shared features.

## Physical-world attacks: patches and stickers

Pixel-level noise dies the moment an image is printed, photographed or re-compressed. So attackers changed the constraint. Instead of "invisible everywhere", the perturbation is "obvious but confined to a small region", and optimised to survive rotation, scaling, lighting and camera noise.

The result is the **adversarial patch**: a sticker that, placed in a scene, drags the classification towards a chosen class regardless of what else is in view. Variants have been demonstrated on printed road signs, on glasses that confuse face recognition, and on clothing that hides people from person detectors. The patch is not hidden. It is just meaningless to a human and overwhelmingly meaningful to a model that was never trained to ignore a brightly coloured square of nonsense.

For anything that takes a camera feed and makes a decision, this is the threat model that matters. Nobody is going to perturb the pixels of a live camera. They are going to hold up a sign.

## Defences: what works, roughly

- **Adversarial training.** Generate adversarial examples during training and train on them with the correct label. This is the most reliable defence known. It is also expensive, typically costs some clean accuracy, and mostly protects against the kind of attack you trained on. PGD-based adversarial training is the usual baseline.
- **Input preprocessing.** JPEG compression, blurring, bit-depth reduction, random resizing and cropping. Each removes some perturbation. Each has been broken by attackers who simply include the preprocessing step in their gradient computation. Useful as a speed bump, never as a wall.
- **Gradient masking.** Making the gradient useless, by adding non-differentiable steps or saturating outputs, feels like a defence and is not one. Transferability means the attacker gets a gradient from somewhere else. Many defences that were later broken were doing this by accident.
- **Certified defences.** Methods such as randomised smoothing give a mathematical guarantee that no perturbation below a certain size changes the prediction. The guarantees are real but the certified radius is small and the accuracy cost is substantial. Think of them as the floor, not the ceiling.
- **Detection.** Try to spot that an input is adversarial. Detectors are classifiers too, and get attacked in exactly the same way, which brings me to the point.

## What this means for deepfake detectors and security ML

Every argument above applies to a detector of AI-generated images. The [field guide to spotting AI images](/blog/how-to-spot-ai-generated-images/) described frequency artefacts, sensor-noise residuals and embedding features. Each of those is a function of the pixels, and each has a gradient. An attacker with a generator and a detector can optimise the generated image to minimise the detector's output while keeping it looking real, which is just FGSM with the loss sign flipped and more steps.

The same holds for intrusion detection, malware classifiers and spam filters: any model deployed against an adversary who benefits from its mistakes will be attacked through its input, and the attacker only has to find one direction that works. This is why the [research](/#research) I care about treats detectors as one layer of evidence rather than the verdict. Design principles that survive contact with an adversary:

1. Combine several independent signals so that fooling one does not fool all.
2. Report calibrated probabilities and reasons, so a human can spot a decision that makes no sense.
3. Assume the attacker has your model, or one close enough to it.
4. Measure robustness under attack, not just clean accuracy, and say which attack.
5. Retrain against the attacks you observe, and accept that this is maintenance, not a one-off fix.

## What to remember

- Adversarial examples exist for nearly every classifier; tiny per-pixel changes add up in high dimensions.
- FGSM is one gradient step on the input. PGD is several. Both are trivial to run against a model you hold.
- Attacks transfer between models trained on similar data, so hiding the weights is not a defence.
- Physical patches trade invisibility for robustness and are the realistic threat for camera-based systems.
- Adversarial training is the only defence that has held up broadly; preprocessing is a speed bump; gradient masking is self-deception.
- Detectors, including deepfake detectors, are classifiers and inherit every weakness above.

## Further reading

- [Explaining and Harnessing Adversarial Examples](https://arxiv.org/abs/1412.6572), the paper that introduced FGSM and the panda.
- [PyTorch tutorial: Adversarial Example Generation](https://pytorch.org/tutorials/beginner/fgsm_tutorial.html), a runnable FGSM walkthrough.
- [NIST AI 100-2: Adversarial Machine Learning taxonomy](https://csrc.nist.gov/pubs/ai/100/2/e2023/final) for the formal vocabulary of attacks and mitigations.

The panda, for the record, was never consulted. If you want to check whether a paper claiming a robust defence is actually robust, that is the [how to read an ML paper post](/blog/how-to-read-a-machine-learning-paper/), where "we evaluated against FGSM only" is a red flag with its own row in the table.
