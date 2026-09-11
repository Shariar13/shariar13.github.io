---
title: "Network Slicing Security in 5G and 6G: What Could Go Wrong"
date: 2026-09-01
description: "What a network slice is, why operators want them, and the security implications: cross-slice attacks, resource exhaustion, compromised orchestration and Zero Trust."
tags: [6G, Zero Trust, Cybersecurity, Research]
---

The first time somebody explained network slicing to me, they used the word "virtual" eleven times in four minutes and I left the room understanding less than when I walked in. The second time, someone drew a single physical cable with three coloured lines inside it and said "these three do not talk to each other, we promise". That was clearer. It was also the moment I started worrying.

"We promise" is doing a lot of work in that sentence. A slice for a hospital's remote monitoring and a slice for a stadium's ten thousand phones can share the same base stations, the same fibre and the same servers. The isolation between them is not a wall. It is configuration.

This post is about network slicing security: what a slice actually is, why operators are keen on them, what happens when the isolation is less real than the diagram, and how the Zero Trust ideas I work with in 6G research apply. No invented breaches, no vendor slides.

## What a network slice actually is

A network slice is a logical, end-to-end network built on shared physical infrastructure. End-to-end matters: a slice is not just a VLAN in the core. It runs from the radio access network, through the transport network, into the core network functions, and out to whatever the service connects to. Each slice gets its own allocation of resources, its own quality-of-service targets and, potentially, its own security policy.

In 5G, a slice is identified by an S-NSSAI (Single Network Slice Selection Assistance Information), which is a slice/service type plus an optional differentiator. The 3GPP specifications define standard service types for the common cases, a device can be attached to several slices at once, and a Network Slice Selection Function decides which slice a session lands in.

Under the hood, this is virtualisation all the way down: software-defined networking for the transport, network function virtualisation for the core, and an orchestration layer that stitches it together. Which means, and this is the point of the post, a slice is only as isolated as the software that defines it.

## Why operators want slicing: eMBB, URLLC and mMTC

One network cannot be good at everything. Video streaming wants throughput and tolerates jitter. Factory robots want a few milliseconds of latency and tolerate low bandwidth. A million smart meters want to send a few bytes a day and never trigger a signalling storm. Building three physical networks would be absurd; building three slices on one is the pitch.

The 5G shorthand for these is eMBB (enhanced Mobile Broadband), URLLC (Ultra-Reliable Low-Latency Communications) and mMTC (massive Machine-Type Communications). 6G work adds more categories, but the pattern holds. Different slices, different needs and, importantly, different security needs:

| Slice type | Typical use | Performance priority | Security priority |
|---|---|---|---|
| eMBB | Video, AR/VR, consumer broadband | Throughput | Confidentiality, fraud prevention |
| URLLC | Industrial control, vehicle coordination, remote medicine | Latency, reliability | Availability, integrity, tamper-proof commands |
| mMTC | Sensors, meters, logistics tags | Device density, low power | Device authentication, resistance to botnet-style floods |
| Private / enterprise | Campus or factory networks | Predictable performance | Strict isolation from public slices, local policy control |

That last column is where things get interesting. A flood against a video slice is annoying. The same flood leaking into a slice that carries commands to a surgical robot is a different category of problem.

## Isolation is a security property, not a marketing word

When an operator says slices are isolated, ask "isolated in what sense?". There are at least three answers:

- **Performance isolation**: one slice cannot starve another of radio, transport or compute resources.
- **Data isolation**: traffic and state in one slice cannot be observed or modified from another.
- **Management isolation**: compromising the control of one slice does not give control of the others.

Each of these is a separate engineering problem, enforced by different layers, and it is entirely possible to have one without the others. A slice with beautifully reserved bandwidth and a shared, flat management plane has performance isolation and nothing else. If your threat model is "a tenant of another slice gets creative", you need all three.

This is the same lesson I keep relearning from [container security](/blog/docker-security-hardening-checklist/): shared kernels and shared control planes are where the isolation story quietly ends.

## Threats to network slices

The threats fall into a handful of families.

**Cross-slice attacks.** A device or function in one slice reaches into another. This can happen through a shared network function that serves multiple slices, a misconfigured routing or firewall rule, or a side channel in shared hardware. A device authorised for a low-security IoT slice should have no path whatsoever to the URLLC slice, and "no path" has to be verified, not assumed.

**Resource exhaustion.** Slices share physical spectrum, links and servers. If the scheduler does not enforce hard limits, a flood in one slice degrades its neighbours. This is the most likely failure in practice, because it does not require breaking anything; it only requires the reservation to have been aspirational.

**Misconfiguration.** Slices are created, modified and torn down by templates and APIs. A template with an overly broad policy, a copy-pasted rule, or a default that allows inter-slice traffic "for testing" turns into a permanent hole. Given how much of this is YAML, I would rate it above any exotic attack.

**Compromised orchestration.** The orchestrator is the thing that defines every slice. Compromise it and you do not need to attack slices individually; you rewrite them. It is the highest-value target in the whole architecture and frequently the least segmented, because it has to talk to everything.

**Weak slice admission.** If any device that joins the network can request any slice, the isolation is only as good as the admission check. 5G added slice-specific authentication precisely because the network-level attach is not enough.

## Zero Trust and per-slice policy

The classic model treats the operator's core as a trusted zone. Slicing, multi-tenancy and third-party network functions make that indefensible, which is why Zero Trust keeps appearing in 6G security discussions. I work on this as part of the Horizon Europe XTRUST-6G project, which looks at Zero Trust for 6G networks; the [6G Zero Trust architecture post](/blog/zero-trust-architecture-for-6g-networks/) covers the overall shape.

Applied to slicing, the principles are concrete:

1. **Every network function has an identity**, not just an IP address in a "trusted" range. Mutual TLS or equivalent between functions, with credentials tied to the slice they belong to.
2. **Policy is explicit and per slice.** Who may talk to whom is written down and enforced at every hop, not implied by topology. Slice A's functions calling Slice B's functions is denied unless a rule says otherwise.
3. **The orchestrator is not exempt.** Its API calls are authenticated, authorised and logged like any other, with least privilege for whoever operates it.
4. **Admission to a slice is a decision, re-evaluated continuously**, taking into account device identity, posture and behaviour, not a one-time attach.

Written as policy-as-code, the core of rule two is almost embarrassingly short:

```rego
package slicing.authz

import rego.v1

default allow := false

# Same slice: allowed
allow if {
    input.source.slice == input.destination.slice
}

# Cross-slice: only via an explicitly approved interconnect
allow if {
    input.source.slice != input.destination.slice
    some rule in data.interconnects
    rule.from == input.source.slice
    rule.to == input.destination.slice
    rule.service == input.destination.service
}
```

The point is not the syntax (there is an [OPA and Rego tutorial](/blog/open-policy-agent-rego-tutorial/) for that). The point is that "slices are isolated" becomes a testable statement rather than a promise.

## Monitoring and telemetry per slice

You cannot enforce isolation you cannot observe. Per-slice telemetry means collecting traffic volumes, latency, authentication events and policy decisions tagged with the slice identifier, so that the questions "is anything crossing slices?" and "is anyone eating another slice's budget?" have answers.

Two habits help. First, alert on policy denials, not just on failures; a burst of denied cross-slice requests is an attacker probing, or a misconfiguration about to become a ticket. Second, baseline each slice separately. An mMTC slice's normal looks nothing like an eMBB slice's normal, and a single global anomaly model will miss both. The same logic that drives [machine learning for intrusion detection](/blog/machine-learning-intrusion-detection/) applies, with the slice as the natural unit of analysis.

## What to remember

- A network slice is a logical end-to-end network on shared infrastructure; its isolation is configuration, not physics.
- Different slice types have different security priorities: availability for URLLC, device authentication for mMTC, confidentiality for eMBB.
- Isolation has three separate meanings (performance, data, management) and you need all of them.
- The realistic threats are resource exhaustion, misconfiguration and orchestrator compromise, before anything exotic.
- Zero Trust makes slicing defensible: per-function identity, explicit per-slice policy, and no exempt control plane.
- Monitor per slice, and treat policy denials as signal.

## Further reading

- [3GPP](https://www.3gpp.org/), where the 5G system architecture and slicing specifications live.
- [NIST SP 800-207, Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) for the principles applied above.

If you want to know what happens when the network functions themselves start running machine learning, the [AI-native 6G threats post](/blog/ai-native-6g-security-threats/) is next, and the rest of the [6G security research](/#research) is on the homepage. Three coloured lines in one cable. We promise.
