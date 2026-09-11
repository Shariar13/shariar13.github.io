---
title: "Zero Trust, Zero Friends: My Journey to Cybersecurity Paranoia"
date: 2026-01-20
description: "Zero Trust Architecture explained: never trust, always verify, NIST SP 800-207 components, micro-segmentation, and why the VPN perimeter model failed."
tags: [Zero Trust, Cybersecurity, Identity]
---

Last month my fridge asked to join the Wi-Fi and I said no. Not because I think it has been compromised, but because I could not think of a single reason it needed to talk to my laptop, and "it came with the feature" is not a reason. It now lives on its own network segment with exactly one permitted destination and, as far as I can tell, has not held a grudge. The printer is in the same situation. The cat has been told that two-factor authentication is coming.

My friends think this is a personality disorder. Some of them are right. But most of it is just Zero Trust Architecture applied at home, which is the natural end state of reading NIST SP 800-207 too many times: you stop asking "is this device inside my network?" and start asking "why should this device be allowed to do this particular thing, right now?"

So this post is Zero Trust explained properly: what "never trust, always verify" actually means, the components NIST defines, why the perimeter model fell over, and the misconceptions that vendors would rather you kept.

## Why the perimeter and VPN model failed

For about thirty years the dominant security model was the castle. A hard outer wall (the firewall), a drawbridge (the VPN), and a soft, trusting interior where anything with an internal IP address was assumed to be friendly. Getting in was hard. Once in, you could wander.

Three things broke it.

- **The inside stopped being inside.** Laptops, phones, cloud services and contractors mean half of "the network" is now a coffee shop with a good view of your data.
- **Attackers learned to walk through the drawbridge.** Phishing gets you a valid set of credentials. A VPN then hands the attacker exactly what it hands an employee: a trusted internal address and a flat network to explore. This is lateral movement, and the flat network is what makes it cheap.
- **Trust was granted once and never re-checked.** You authenticated at 9 a.m. and were trusted until you logged off. If your session was hijacked at 9:05, the network had no opinion on the matter.

The VPN is not evil. It is a perfectly good answer to "encrypt traffic across the internet" that got promoted, without an interview, to "decide who can access what". Those are different jobs.

## What "never trust, always verify" actually means

The slogan is easy to misread as "trust nothing", which is a description of a network that does not work. What it actually means is:

1. **Location is not a credential.** Being on the office LAN, on the VPN, or in the same subnet grants nothing by itself.
2. **Every request is evaluated on its own.** Not every session; every request, or as close to that as performance allows. The subject, the device, the resource and the context are all inputs.
3. **Access is least-privilege and per-resource.** You get the one thing you asked for, for as long as you need it, not the whole segment it lives in.
4. **The decision uses current information.** Device health, recent behaviour, time of day, and whether this account was just seen logging in from two continents at once.

The part people skip is that trust is not binary. A managed laptop with a patched operating system gets more than an unknown phone; the same laptop, after failing three MFA prompts, gets less. Trust is a score that moves, not a badge you hand out at the door.

## The NIST SP 800-207 components: PE, PA and PEP

NIST SP 800-207 is the document everyone cites and few read. Its most useful contribution is a small vocabulary that lets you draw the architecture without a vendor logo on it.

- **Policy Engine (PE)**: the brain. It takes the request, pulls in identity, device posture, threat intelligence and policy, and decides allow or deny.
- **Policy Administrator (PA)**: the hands. It turns the decision into action: opens a session, issues a token, and tears the connection down when the PE changes its mind.
- **Policy Enforcement Point (PEP)**: the door. It sits in the data path between the subject and the resource and does what it is told. A reverse proxy, an agent, a gateway, a service-mesh sidecar.

NIST calls the PE and PA together the **control plane**; the PEP lives in the **data plane**. The subject never talks to the resource directly. Every request goes through a PEP, and the PEP is only as smart as the PE behind it.

Feeding the PE are what the document calls supporting sources: an identity provider, a device inventory and compliance system, a SIEM or activity log, threat feeds, and the policies themselves. A Zero Trust deployment is mostly the plumbing between those things.

## Identity-centric access and micro-segmentation

Two design ideas carry most of the weight.

**Identity-centric access** means the primary question is "who or what is asking?", answered by strong authentication: a human with MFA, a workload with a short-lived certificate, a device with an attested identity. The IP address is a hint at best. In practice this pushes you towards an identity provider issuing short-lived tokens and every service validating them, which is the world of [OAuth 2.0 and OpenID Connect](/blog/oauth2-oidc-keycloak-explained/).

**Micro-segmentation** means shrinking the "inside" until it barely exists. Instead of one flat network where the payroll database can hear the printer, each workload sits in a segment of one, and the only way in is through a PEP that checks policy. A compromised printer can then attack precisely nothing except its own print queue. This is my fridge's situation, and I stand by it.

The two ideas are complementary. Identity says who you are; segmentation limits what being you can reach.

## Continuous verification: the part that makes it Zero Trust

Authenticating once and issuing a long-lived session is just the perimeter model wearing a new hat. Continuous verification means the decision is revisited as the signals change:

- The device fails a compliance check mid-session: the PA tells the PEP to drop the connection.
- The account's behaviour shifts (new country, unusual volume): its trust score falls and sensitive resources demand step-up authentication.
- The token expires after minutes rather than days, so revocation actually means something.

The signals come from telemetry, which is why a [SIEM stops being a compliance box and becomes an input](/blog/siem-explained-for-developers/) to access decisions. Logging is no longer only about finding out afterwards; it is about changing the answer now.

## Perimeter vs Zero Trust at a glance

| Question | Perimeter model | Zero Trust |
|---|---|---|
| What earns trust? | Network location, VPN session | Verified identity, device posture, context |
| When is it checked? | Once, at login | Every request, continuously |
| Scope of access | Whole network segment | One resource, least privilege |
| Where is enforcement? | Edge firewall | A PEP in front of every resource |
| Lateral movement | Cheap once inside | Expensive, thanks to micro-segmentation |
| Logs are for | Audits afterwards | Live inputs to policy |

## Common misconceptions about Zero Trust

**"Zero Trust is a product."** It is an architecture. Vendors sell components that can act as a PE, PA or PEP; nobody sells the whole thing, because the whole thing includes your identity data, your device inventory and your policies. Anyone selling "Zero Trust in a box" is selling a box.

**"Zero Trust means no VPN."** It means the VPN no longer decides authorisation. Keep it for transport if you like; just stop treating it as a credential.

**"It is a project with an end date."** It is a direction. NIST describes principles you move towards, not a checkbox you tick.

**"It is only for big enterprises."** The principles scale down. Per-resource authentication and short-lived tokens are just as sensible for three microservices as for three thousand. They are also, it turns out, sensible for kitchen appliances.

**"Users will hate it."** Users hate re-typing passwords and fighting VPN clients. Done well, Zero Trust replaces both with device-bound identity and silent posture checks. The paranoia should live in the control plane, not in the user's day.

## What to remember

- Zero Trust means location grants nothing; every request is authorised on identity, device and context.
- NIST SP 800-207 defines a Policy Engine (decides), a Policy Administrator (acts) and a Policy Enforcement Point (sits in the path).
- Micro-segmentation makes lateral movement expensive; identity-centric access makes the IP address irrelevant.
- Verification is continuous: trust is a changing score, and telemetry feeds the decision.
- It is an architecture and a direction, not a product or a project.

## Further reading

- [NIST SP 800-207, Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final), the primary source and shorter than you fear.
- [NCSC Zero Trust architecture design principles](https://www.ncsc.gov.uk/collection/zero-trust-architecture), a readable UK companion.

Next, the same principles applied to a network with a few billion devices in it: [Zero Trust for 6G networks](/blog/zero-trust-architecture-for-6g-networks/), which is where most of my [research time](/#research) goes. The fridge, meanwhile, remains on probation.
