---
title: "What Is a Cyber Range? Why Hands-On Labs Beat Slides"
date: 2026-03-17
description: "What a cyber range is, the main types of hands-on security lab, the components that make one work, and how to design and assess a good lab exercise."
tags: [Cyber Range, Education, Cybersecurity]
---

In a discussion with one of my professors, they described a common situation in security teaching. A lecturer delivers a full session on SQL injection, with diagrams and worked examples of vulnerable queries. At the end a student asks whether they can try it themselves. The answer has to be no, because the only systems available are live university services, and attacking those is not an option. The observation, and the idea behind this post, came from that discussion rather than from me.

That is the problem in one sentence. Cybersecurity is a practical discipline that we mostly teach by describing practice. You cannot learn to pick a lock from a diagram of a lock, and you cannot learn to find a vulnerability from a slide with the vulnerability circled in red. A cyber range is the fix.

This post explains what a cyber range is, the main types, what goes into building one, and how to design a lab exercise that teaches something rather than just occupying a Tuesday afternoon. I work on a cyber range platform used for university lab sessions, so this is a mix of design principles and things I got wrong first.

## What is a cyber range?

A **cyber range** is an isolated, controlled environment where people can attack, defend and investigate computer systems without any risk to real ones. The name is borrowed from a firing range: a place with targets, a safe direction to point, and someone watching that you do not point anywhere else.

The word "isolated" is doing most of the work. A cyber range is not a vulnerable virtual machine on your laptop, although that is a fine way to start. It is infrastructure with three properties:

- **Safe scope.** Nothing inside can reach anything outside that it should not, and nothing outside can reach in except through the intended door.
- **Reproducibility.** Every learner gets the same starting state, and it can be reset when they break it, which they will, on purpose.
- **Observation.** The range can tell you what happened, whether for scoring, feedback or the interesting moment when a student does something you did not anticipate.

## Types of cyber range lab

Different questions need different kinds of environment. The main lab types I use:

| Lab type | What it looks like | Best for teaching | Effort to build |
|---|---|---|---|
| CTF-style challenge | One container or VM with a specific flaw and a flag to capture | A single technique: SQLi, a misconfigured service, a crypto mistake | Low |
| Emulated enterprise network | A subnet with domain controller, workstations, file server, web app | Enumeration, lateral movement, privilege escalation, defence in depth | High |
| Red vs blue exercise | Two teams on one network, one attacking, one defending live | Incident response, detection, communication under pressure | High, plus refereeing |
| Forensics / analysis | A disk image, packet capture or log set, no live target | Investigation, evidence handling, reasoning from artefacts | Low to medium |
| Guided walkthrough | A challenge with staged hints and checkpoints | First-year students, confidence building | Low |

CTF-style challenges are the workhorse. They are cheap to build, cheap to reset, and each one teaches one thing cleanly. Enterprise emulations teach that the vulnerability is rarely on the box you started with. Red versus blue is the most fun and the hardest to run well, because it needs an honest referee, a clock, and a plan for when the red team wins in the first ten minutes.

## Core components of a cyber range

Most ranges share the same parts, whatever the technology.

1. **Isolated networks.** Each team or student gets their own network segment. Containers on it can reach each other and nothing else. In Docker terms this is a per-team network with `internal: true`; in a VM setup it is a VLAN per team.
2. **VPN access per team.** Students connect through a VPN that drops them onto exactly their segment. One configuration file per team, revoked at the end of the session.
3. **Challenge containers or VMs.** The vulnerable targets themselves, built from a definition (a compose file, an image, a snapshot) so they are identical every time.
4. **A scoring service.** Flags submitted, hints used, time taken. The scoreboard is the only piece students see constantly, so it is worth making reliable; I learned that the hard way in [when you Docker Compose into chaos](/blog/when-you-docker-compose-into-chaos/).
5. **Reset and snapshots.** A button that returns a challenge to its initial state. Students will delete the flag file, fill the disk or crash the service, and the answer must be "reset it" rather than "wait until next week".
6. **Monitoring.** Enough logging to answer "what did team four do at 14:32", both for assessment and for noticing when someone is attacking the scoreboard instead of the challenge.

Hardening the challenge containers themselves is a topic on its own; the short version is that students will try to escape, so assume it and read the [Docker security hardening checklist](/blog/docker-security-hardening-checklist/).

## How to design a good lab exercise

The technology is the easy part. The exercise is what teaches. The ones that work share four properties.

**A clear objective.** "Explore the box" is not an objective. "Obtain the contents of `/root/flag.txt` and explain which misconfiguration allowed it" is. Students should know what done looks like before they start.

**Realistic but bounded.** The target should resemble something that exists, with plausible services and plausible mistakes, but the path should be finite. If a challenge has one intended route and four accidental ones, you will spend the session adjudicating whether the accidental ones count. Test it with a colleague who does not know the answer.

**Staged hints.** The gap between "stuck" and "learning" is about ten minutes. Hints that reveal progressively more, at a small score cost, keep people moving without giving the game away. The best hints point at the technique, not the answer: "what does this service tell you about itself?" rather than "run this command".

**Safe scope, stated explicitly.** Every exercise should say what is in scope, what is not, and what happens if you attack the infrastructure. Scope, authorisation and rules of engagement are the first thing a professional establishes, and it is worth reading about [penetration testing methodology](/blog/penetration-testing-methodology-for-beginners/) before running a lab, because the habits students form on a range are the habits they take into work.

### An example challenge outline

Here is the skeleton I use for a single CTF-style challenge, roughly an hour of student time:

- **Title:** Ticket Office
- **Objective:** Retrieve the flag stored in the application database and identify the vulnerability class.
- **Target:** One web container (a small ticket booking app) on the team network, port 8080.
- **Intended path:** Enumerate the site, find the search parameter, confirm SQL injection, extract the flag from the `secrets` table.
- **Out of scope:** The scoreboard, the VPN gateway, other teams' networks, denial of service.
- **Hints (in order):** "Try characters the developer did not expect." / "The error message is more helpful than it should be." / "UNION-based extraction; count the columns first."
- **Deliverable:** The flag, plus three sentences: what the flaw was, how it was found, and one fix.
- **Reset:** Container restart restores the database from the image.

The deliverable is deliberate. A flag on its own proves you can follow a walkthrough. Three sentences prove you understood it.

## Assessment ideas for lecturers

Ranges make assessment easier, not harder, if you decide up front what you are measuring.

- **Flags plus rationale.** Award most of the marks for the explanation, not the flag. This also blunts the value of copying a flag from a friend.
- **Timed enumeration reports.** Give students an unknown network for thirty minutes and mark the quality of what they found and documented, not whether they got a shell.
- **Defensive tasks.** Hand them a compromised container and ask them to find the intrusion, fix the flaw and prove it is fixed.
- **Peer challenge authoring.** Students build a small challenge for another group. Nothing teaches a vulnerability like trying to plant one convincingly.

## Common mistakes when running a cyber range

- **Fragile infrastructure.** If the range falls over under load, the session becomes a lesson in patience. Load-test it with twice the number of students you expect.
- **One route, no hints.** Half the room finishes early; the other half learns nothing.
- **No scope statement.** Someone will scan the university network. Make sure it is clearly their fault, not yours.
- **Grading the flag.** See above. The flag is evidence, not the assessment.
- **Never resetting between cohorts.** Old flags, old shells, old notes left in `/tmp`. Every cohort starts clean or the challenge is not the challenge.

## What to remember

- A cyber range is an isolated, resettable, observable environment for practising attack and defence safely.
- CTF challenges teach one technique cheaply; emulated networks teach how real compromises unfold; red versus blue teaches pressure.
- The core parts are per-team isolated networks, VPN access, reproducible targets, scoring, reset and monitoring.
- Good exercises have a clear objective, a bounded realistic path, staged hints and an explicit scope.
- Mark the explanation, not the flag.

## Further reading

- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) for the techniques most web challenges are built around.
- [Docker Compose documentation](https://docs.docker.com/compose/) if you are building challenge stacks from scratch.

The lecture on SQL injection can stay exactly as it is. The difference is that it now ends with a URL to a lab where the student can try it.
