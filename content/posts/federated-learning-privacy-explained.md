---
title: "Federated Learning Explained: Privacy-Preserving ML"
date: 2026-06-23
description: "Federated learning explained: FedAvg, why shared gradients leak, differential privacy, secure aggregation, and the real costs in healthcare and 6G."
tags: [Machine Learning, AI, Cybersecurity, 6G]
---

A hospital once asked me, in effect, whether they could have the benefits of a model trained on five hospitals' scans without any of the five hospitals sending anyone their scans. My first instinct was to say no, that is not how training works. My second instinct was to remember that this is precisely how federated learning works, and that I had read the original paper only a few weeks earlier.

The idea is disarmingly simple. Instead of moving the data to the model, you move the model to the data. Each site trains locally, sends back what it learnt rather than what it saw, and a server stitches the lessons together. Nobody's patient records leave the building.

It is also, and this is the part the vendor slides tend to skip, not automatically private. So this post is federated learning explained properly: the core idea, the standard algorithm, the ways it leaks, the two tools that actually make it private, and what it costs to run in the real world.

## The core idea: train where the data lives

In ordinary machine learning you gather everything into one place and train there. That is fine for cat photos. It is a problem for medical records, phone keyboards, bank transactions or telemetry from a telecom network, where the data is sensitive, regulated, enormous, or all three.

**Federated learning** keeps the data where it is. A central server holds a global model. Each participant, or **client**, downloads it, trains it for a while on local data, and uploads only the resulting change to the model's weights. The server combines the changes and sends out an improved global model. Repeat until it stops improving.

The client might be a hospital with a server rack or a phone with a keyboard app. Same mechanism, different scale. The thing that crosses the network is a model update, which is a long list of numbers, and not a single training example.

## FedAvg intuition, with a sketch

The standard algorithm is **Federated Averaging (FedAvg)**, and the name is the explanation. Each client does some local gradient descent. The server averages the resulting weights, giving clients with more data more say. That is it.

Here is a PyTorch-flavoured sketch of one round, with everything except the averaging left out:

```python
import copy

def fedavg_round(global_model, clients, local_epochs=1):
    global_state = global_model.state_dict()
    updates, sizes = [], []

    for client in clients:
        local = copy.deepcopy(global_model)
        local.load_state_dict(global_state)
        train(local, client.data, epochs=local_epochs)  # data never leaves the client
        updates.append(local.state_dict())
        sizes.append(len(client.data))

    total = sum(sizes)
    new_state = {
        key: sum(u[key] * (n / total) for u, n in zip(updates, sizes))
        for key in global_state
    }
    global_model.load_state_dict(new_state)
    return global_model
```

Two things to notice. First, `train()` runs several steps locally before anything is sent, which is what makes FedAvg cheap on communication compared with sending every single gradient. Second, the average is weighted by `sizes`, so a client with ten thousand examples counts more than one with fifty. Both choices have consequences, which we will get to.

## Why federated learning is not automatically private

Here is the uncomfortable part. A model update is a function of the training data. Under the right conditions, it is a reversible one.

**Gradient leakage** attacks take the update a client sent and optimise a fake input until it would have produced the same update. For small batches and image models this can reconstruct the training image well enough to recognise a face. The data never left the hospital, and yet here is a reasonable likeness of it on the server. "We only share gradients" turns out to be a description of the attack surface, not a defence.

**Membership inference** is the subtler cousin. The attacker cannot see the record, but they can ask whether a specific record was in the training set, by checking whether the model is suspiciously confident about it. For a dementia dataset, "this person's scan was used" is itself a diagnosis.

Then there is the honest-but-curious server, the malicious client who poisons the global model, and the update that happens to be from the only client in the round. Federated learning changes where the data sits. It does not, on its own, change what can be learnt from the updates.

## Differential privacy: epsilon and noise, at a high level

**Differential privacy (DP)** is the formal answer to "what can be learnt from the output?". A mechanism is differentially private if its output would look almost the same whether or not any single individual's record was included. The "almost" is a number called **epsilon**: smaller means the two cases are harder to tell apart, meaning more privacy. An epsilon of, say, one is meaningfully protective; an epsilon of fifty is a certificate with no protection attached.

In practice, DP for federated learning means two steps at each client before the update is sent:

1. **Clip** the update so no single example can push it further than a fixed bound.
2. **Add noise**, usually Gaussian, scaled to that bound, so the contribution of any one record is hidden in the noise.

The cost is accuracy. Noise you add to protect privacy is noise the model has to learn through, and every training round spends a bit of the privacy budget, so you cannot train forever. Choosing epsilon is not a technical decision; it is a statement about how much accuracy you are willing to give up for a guarantee you can actually write down.

## Secure aggregation: the server sees only the sum

Differential privacy protects against what the output reveals. **Secure aggregation** protects against what the server sees on the way in.

The intuition is masking. Each pair of clients agrees on a random mask; one adds it to their update and the other subtracts it. Each client sends its masked update, which on its own is indistinguishable from random noise. When the server adds all of them together, the masks cancel out, and it is left with the sum of the real updates and nothing else. It never sees an individual client's contribution, only the aggregate.

Combine the two and you get the sensible design: secure aggregation so no single update is ever visible, and differential privacy so the aggregate itself does not give individuals away. Neither one alone is enough, and I have yet to see a product page admit that.

## Where federated learning fits: healthcare and the 6G edge

Two settings make the whole trade-off worthwhile.

**Healthcare** is the obvious one. Medical imaging models want data from many hospitals, because a model trained on one scanner in one city generalises badly. Moving scans between institutions is a regulatory nightmare. Moving models is paperwork, but survivable. The [dementia detection work](/blog/machine-learning-dementia-detection/) I wrote about earlier is exactly the kind of model that would benefit from more sites and more scanners, and the reason that is hard to arrange is the problem federated learning exists to solve.

**Telecoms** is the less obvious one, and where I spend my time now. A 6G network has thousands of edge nodes, each seeing local traffic, each able to train an anomaly detector on what it sees, and none of which should be shipping raw traffic to a central server. That is federated learning with a Zero Trust twist, because the clients are also the things being protected, and any of them might be compromised. My work on [Zero Trust for 6G networks](/blog/zero-trust-architecture-for-6g-networks/) touches on this.

## The practical costs: non-IID data, stragglers, communication

If federated learning were free, everyone would use it. The bill arrives in three parts.

- **Non-IID data.** Each client's data has its own distribution: one hospital sees older patients, one edge node sees mostly video. Local training pulls each copy of the model in a different direction, and the average of several good local models can be a mediocre global one. This is called client drift, and it is the reason most of the algorithms after FedAvg exist.
- **Stragglers.** Some clients are slow, offline, or on battery. Wait for them and a round takes forever; drop them and you bias the model towards clients with good connectivity, which is rarely the population you care about.
- **Communication.** A modern model's weights can run to hundreds of megabytes. Sending that up and down every round, to thousands of clients, is the dominant cost. Compression, quantisation and sending fewer, larger local updates all help, and all trade against accuracy.

Add DP noise and secure aggregation overhead to that list, and "just do it federated" becomes a design project rather than a checkbox. It is still frequently the right project. It is just not a free one.

## What to remember

- Federated learning trains where the data lives and shares model updates, not records.
- FedAvg is local training followed by a data-weighted average of the weights.
- Updates leak: gradient inversion and membership inference are real attacks, not edge cases.
- Differential privacy bounds what the output reveals; smaller epsilon means more privacy and more noise.
- Secure aggregation hides individual updates from the server; you want both, not either.
- Non-IID data, stragglers and communication cost are the price, and they are not small.

You can find the rest of the 6G and privacy work on the [research page](/#research). Or, if you prefer, keep emailing spreadsheets of patient data around and hope. Only one of these approaches comes with a proof attached.
