---
title: "ML Models Are Like Toddlers: Why Training Is Unstable"
date: 2026-03-03
description: "Why neural network training is unstable: learning rate, exploding gradients, overfitting, early stopping, dropout, batch norm, LR schedules and seeds."
tags: [Machine Learning, Deep Learning, AI]
---

My last classifier learned to fear cats. The retrained one, with the data properly balanced, did something worse: it refused to learn anything at all. The loss went down for three epochs, shot up to a number with an exponent in it, and then became `nan`, which is the machine-learning equivalent of a child lying flat on the supermarket floor.

I have since spent enough evenings watching loss curves to reach a conclusion. Neural network training is unstable for the same reasons toddlers are: too much energy, no sense of proportion, an ability to memorise the wrong lesson perfectly, and wild swings in behaviour depending on what happened at breakfast.

This post goes through the main reasons training goes wrong and the standard fixes, one tantrum at a time. It follows on from the [class imbalance post](/blog/how-i-taught-my-neural-network-to-fear-cats/), which was about bad data. This one is about what happens when the data is fine and the model still will not behave.

## Learning rate: the volume knob is set to eleven

The learning rate decides how far the optimiser steps along the gradient each update. Too low and the model shuffles towards a solution at glacial pace. Too high and it overshoots, bounces across the loss surface, and lands somewhere worse than where it started. That is my exponent-and-then-`nan` curve: each step was so large that the weights grew, the outputs grew, the loss grew, the gradients grew, and the whole thing went to infinity in a few iterations.

The tell is a loss that decreases briefly, then oscillates or diverges. The fix is boring: drop the learning rate by a factor of ten and try again. A learning-rate range test, where you increase the rate every few batches and watch when the loss stops falling, will find a sane range in minutes. Toddlers do not have this knob. Models do. Use it.

## Exploding and vanishing gradients

Backpropagation multiplies gradients layer by layer on the way back. In a deep network, if those factors are consistently greater than one, the gradient grows exponentially with depth and **explodes**. If they are consistently less than one, it shrinks to nothing and **vanishes**. Either way, the early layers are learning from noise or from nothing.

Exploding gradients look like the learning-rate problem, and the two feed each other. **Gradient clipping** is the direct fix: rescale the gradient vector whenever its norm exceeds a threshold, so a single bad batch cannot fling the weights across the room.

Vanishing gradients are quieter. The loss plateaus, the early layers barely change, and you conclude the model has "converged" when it has actually given up. The structural fixes are the ones that made deep networks work in the first place: ReLU-style activations that do not squash gradients, careful weight initialisation, residual connections that give the gradient a shortcut, and batch normalisation, which gets its own section below.

## Overfitting versus underfitting: too much candy, too little

A model **underfits** when it is too simple, too regularised or trained too briefly to capture the pattern. Training loss and validation loss are both high. The toddler is bored and has learned nothing.

A model **overfits** when it captures the training set so precisely that it captures the noise too. Training loss keeps falling, validation loss bottoms out and starts to climb. The toddler has memorised every word of one picture book and will recite it at you regardless of what you ask.

The diagnostic is the gap between the two curves. No gap and both high: add capacity or train longer. Growing gap: the model needs less freedom, more data, or an earlier finish. The way to tell which is to plot both curves every run, which sounds obvious and is skipped by a remarkable number of people who then tune the wrong thing.

## Early stopping, dropout and weight decay

Three regularisers do most of the work in practice.

- **Early stopping** watches validation loss and stops training when it has not improved for a set number of epochs, called the patience. It is the cheapest regulariser there is: you were going to train anyway, you just stop at the right moment and keep the best checkpoint.
- **Dropout** randomly zeroes a fraction of activations during training, so no single neuron can be relied on. The network is forced to spread its representation. At inference time dropout is switched off, which is why `model.eval()` matters and why forgetting it produces mysterious accuracy drops.
- **Weight decay** adds a penalty on the size of the weights, nudging them towards zero unless the data justifies otherwise. Large weights are what let a network carve very sharp decision boundaries around individual training points, so shrinking them smooths the model.

None of these is a substitute for more data. They just stop the model doing anything silly with the data it has.

## Batch normalisation: a routine calms everyone down

Batch normalisation standardises the activations of a layer across each mini-batch, then lets the network learn a scale and shift. The effect is that every layer sees inputs in roughly the same range regardless of what the layers before it are doing. Training becomes tolerant of higher learning rates and worse initialisation, and gradients stop vanishing quite so readily.

The catch is that it behaves differently in training and evaluation. During training it uses the batch statistics; during evaluation it uses running averages accumulated along the way. Very small batches give noisy statistics, and evaluating with the model still in training mode gives you results that change depending on what else was in the batch. If your validation accuracy is inexplicably jittery, check that you called `model.eval()`.

## A learning-rate schedule and early stopping in PyTorch

Rather than pick one learning rate, most training runs change it over time: warm up gently, then decay. Cosine annealing and step decay are the common shapes. Here is the minimal version of a schedule plus early stopping, with the training step left out because yours will differ:

```python
import copy
import torch

optimiser = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-2)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, T_max=epochs)

best_loss, best_state, patience, bad_epochs = float("inf"), None, 5, 0
for epoch in range(epochs):
    train_one_epoch(model, train_loader, optimiser)  # clip grads inside if needed
    scheduler.step()
    val_loss = evaluate(model, val_loader)           # calls model.eval() inside
    if val_loss < best_loss:
        best_loss, best_state, bad_epochs = val_loss, copy.deepcopy(model.state_dict()), 0
    else:
        bad_epochs += 1
        if bad_epochs >= patience:
            break
model.load_state_dict(best_state)
```

Inside `train_one_epoch`, `torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)` between `backward()` and `step()` is the gradient-clipping line. That is the whole safety harness: a decaying step size, a cap on how far one step can go, and a checkpoint of the best moment before things went downhill.

## Random seeds: the same toddler, a different day

Run the identical script twice and get two different accuracies. Weight initialisation, data shuffling, dropout masks and some GPU kernels are all random. On a small dataset the spread between runs can be bigger than the improvement you are trying to measure, which means the "better" architecture you just picked may simply have had a lucky seed.

Set the seeds for Python, NumPy and PyTorch, and set the deterministic flags if you need bit-for-bit repeatability. Then, and this is the part people skip, run the important comparisons across several seeds and report the mean and spread. One run is an anecdote. Five runs is a small experiment. Both are better than my original approach, which was to keep re-running until the number looked good and then stop.

## What to remember

- Diverging loss usually means the learning rate is too high. Divide by ten before doing anything clever.
- Clip gradients to stop explosions; use ReLU, residual connections and batch norm to stop vanishing.
- Plot training and validation loss together. The gap between them tells you whether to add capacity or constrain it.
- Early stopping, dropout and weight decay are the default regularisers. They are cheap; use them.
- Batch norm and dropout behave differently at evaluation time. Call `model.eval()`.
- Fix the seeds, then vary them. A result that only works on one seed is not a result.

## Further reading

- [PyTorch: torch.optim and learning-rate schedulers](https://pytorch.org/docs/stable/optim.html) for every schedule shape and its parameters.
- [PyTorch: clip_grad_norm_](https://pytorch.org/docs/stable/generated/torch.nn.utils.clip_grad_norm_.html) for the gradient-clipping call.
- [PyTorch: Reproducibility](https://pytorch.org/docs/stable/notes/randomness.html) for what setting the seeds does and does not guarantee.

Mine eventually converged after twenty-seven epochs, a smaller learning rate and a patience of five, and then behaved beautifully right up until deployment, when it met real data and forgot everything. That story belongs on the [research page](/#research) and in the next post on [transfer learning](/blog/transfer-learning-explained/), which is what I should have started with.
