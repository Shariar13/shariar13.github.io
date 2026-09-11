---
title: "AI-Native 6G Security Threats: Poisoned Models and Zero Trust"
date: 2026-08-18
description: "What AI-native 6G means and the security threats it brings: data poisoning, model theft, adversarial inputs, telemetry privacy and why Zero Trust matters."
tags: [6G, Zero Trust, AI, Cybersecurity]
---

In a 5G network, when something goes wrong, a person eventually opens a configuration file. In an AI-native 6G network, the plan is that a model opens it first. I asked, at a workshop, what happens if the model is wrong. The answer was a diagram with a box labelled "AI orchestration" and an arrow pointing back at itself.

That box is where I spend my working days. In my research I work on Zero Trust for 6G, which mostly means asking what happens when the thing making network decisions is a model that somebody could have tampered with.

So this post is about AI-native 6G security threats: what "AI-native" actually means, where the new attack surface is, and why the answer keeps coming back to continuous verification. If you want the Zero Trust groundwork first, start with [Zero Trust architecture for 6G networks](/blog/zero-trust-architecture-for-6g-networks/); this post is the sequel where the models turn on you.

## What "AI-native" 6G actually means

Today's networks already use machine learning, but it sits at the edge of the design: an analytics box that suggests, a human that approves. AI-native means the models are part of the control loop by design, not bolted on afterwards.

Concretely, in the **radio access network (RAN)** that means models handling beam management, scheduling, handover prediction and energy saving, deciding in milliseconds which antenna serves which device. In the **core**, it means models steering traffic, allocating **network slices** (isolated virtual networks with their own guarantees, so a hospital's slice and a gaming slice do not share fate), detecting faults and predicting demand. The O-RAN Alliance's architecture already has a place for this: a RAN Intelligent Controller running third-party applications, known as xApps and rApps, that observe the network and push decisions back into it.

Two things follow. The models have write access to the network. And many of them will be written by someone other than the operator.

## The attack surface of network AI

Every classical threat to a telecom network is still there. AI-native adds a new layer on top, and it is worth going through it systematically.

| Threat | What the attacker does | What breaks |
|---|---|---|
| Data poisoning | Injects crafted traffic or telemetry so the training data teaches the model something false | A traffic classifier learns that the attacker's flows are "video streaming" and prioritises them |
| Model theft | Queries a deployed model repeatedly to reconstruct it, or lifts the weights from a compromised node | The attacker can now craft inputs offline and probe for weaknesses at leisure |
| Adversarial inputs | Sends signals or packets shaped to be misclassified at inference time | A spectrum-sensing model sees an empty channel that is occupied; an intrusion detector sees benign where there is malware |
| Model supply chain | Compromises a pre-trained model, a dependency or an xApp before it reaches the operator | The network runs a model with a backdoor, triggered by a pattern only the attacker knows |
| Telemetry privacy | Harvests the data the models are trained on, or infers it from model behaviour | Subscriber location, usage patterns and device fingerprints leak from what was supposed to be operational data |

A few of these deserve more words.

**Data poisoning** is the one unique to systems that keep learning. Network AI is typically retrained on live telemetry, because that is the whole point. If an attacker can shape what the network observes, by generating traffic, spoofing measurements or controlling a few compromised devices, they can shape what it learns. This does not need a dramatic exploit. It needs patience and a botnet.

**Adversarial inputs** are the network cousin of the image-classifier attacks I covered in [adversarial examples: fooling image classifiers](/blog/adversarial-examples-fooling-image-classifiers/). The same principle applies: a small, deliberate perturbation the model was never trained to handle flips its output. For a traffic classifier, that is packet timing and size patterns. For spectrum sensing, it is radio-frequency interference shaped to look like something else. The perturbation costs the attacker almost nothing and the model gives no sign anything is wrong.

**Supply chain** is the dull one that will actually happen. Operators will not train every model from scratch. They will take pre-trained models, third-party xApps and open-source dependencies, and they will do it under commercial pressure. Every one of those is a place to insert something. The lesson of software supply chain attacks was that trust in a package name is not a security control. The same is true of a model file.

**Telemetry** is the privacy problem. The data that makes network AI work, signal measurements per device, per cell, per second, is also a fine-grained record of where people are and what they are doing. The models are trained on it, and models can be coaxed into revealing their training data. Operational data does not stop being personal data because it went through a model.

## Why Zero Trust and continuous verification matter

The traditional telecom security model assumes that inside the operator's network is trusted. AI-native 6G breaks that assumption in a specific way: the components making decisions are numerous, third-party, frequently updated, and by design change their behaviour based on data. An implicitly trusted model that has been poisoned is an insider threat with root.

**Zero Trust**, as laid out in NIST SP 800-207, replaces "inside means trusted" with "every request is authenticated, authorised and evaluated on current evidence". Applied to network AI, that means:

- Every model and every xApp has an identity, is authenticated, and is authorised only for the specific actions and slices it needs. A beam-management model has no reason to touch the core.
- Authorisation is re-evaluated continuously, not granted once at deployment. A model that starts producing outputs outside its expected distribution loses its permissions until someone looks.
- Trust in a model's decision is proportional to evidence about the model: where it came from, what it was trained on, how it has been behaving.

**Continuous verification** is the half of Zero Trust people forget. Signing a model at deployment proves what it was. It proves nothing about what it does an hour later with poisoned inputs. Verification has to be ongoing and behavioural, which is why monitoring turns out to be a security control rather than an operations nicety.

## Defences for AI-native 6G, at a high level

None of this is solved. But the shape of the defences is fairly clear, and most of them are extensions of things security engineers already know how to do.

1. **Provenance for models.** Sign model artefacts, record training data lineage and versions, and verify signatures before anything is loaded. Treat a model like a software package with a bill of materials, because it is one.
2. **Model monitoring.** Track input and output distributions, confidence, and decision rates per model. Alert on drift. Keep known-answer test inputs and check them regularly; a model that starts getting the canaries wrong has changed.
3. **Isolation via slicing.** Use network slicing as a containment boundary as well as a service one. A model serving one slice should have no path to another. If a poisoned traffic classifier can only misroute within its own slice, the blast radius is bounded.
4. **Poisoning-aware training.** Validate telemetry before it enters a training set, limit how much influence any single source has, and keep a clean holdout to detect when a retrain has gone strange.
5. **Adversarial robustness testing.** Attack your own classifiers before deployment. If a spectrum model can be flipped by cheap interference, better to know in the lab.
6. **Privacy in telemetry pipelines.** Minimise, aggregate, and where the data is genuinely personal, use privacy-preserving techniques so the model never needs the raw record.

The theme is that a model in the control plane gets the same treatment as any other privileged component: identity, least privilege, provenance, monitoring, containment. The technology is new; the discipline is not.

## What to remember

- AI-native means models have write access to the network, and many will be third-party.
- The new attack surface is data poisoning, model theft, adversarial inputs, model supply chain and telemetry privacy.
- Poisoning is the threat unique to systems that retrain on live data; it needs patience, not an exploit.
- Zero Trust applies to models: identity, least privilege, and authorisation re-evaluated on current behaviour.
- Continuous verification means monitoring is a security control.
- Provenance, monitoring, and slicing as containment are the practical starting points.

## Further reading

- [NIST SP 800-207, Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final).
- [ENISA](https://www.enisa.europa.eu/) for European guidance on telecom and AI security.
- [MITRE ATLAS](https://atlas.mitre.org/) for a catalogue of attack techniques against machine learning systems.
- [O-RAN Alliance](https://www.o-ran.org/) for the architecture where xApps and rApps live.

More on this as the [research](/#research) develops. In the meantime, if a diagram has an arrow pointing back at itself, ask who signed the box.
