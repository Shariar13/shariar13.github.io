---
title: "Python Virtual Environments: Stop Saying It Works on My Machine"
date: 2026-03-10
description: "Why global pip installs break, how to make a Python virtual environment in three commands, and how to pin dependencies so research code runs again."
tags: [Python, DevOps]
---

Picture a research team handing over a repository with a proud note: "Just run `main.py`." The recipient runs it. Something about `numpy` has no attribute something. They upgrade `numpy`. Now a different library complains that `numpy` is too new. They downgrade. The original author is, at this point, unreachable and possibly at a conference.

"It works on my machine" is not a lie. It is a confession. The machine has a specific pile of packages, installed in a specific order, over a specific number of years, and the code only works inside that pile. The pile was never written down.

Python virtual environments exist to write the pile down. They take ten seconds to set up and are the cheapest reproducibility win going, which is why so many people skip them.

## Why global pip installs go wrong

When you run `pip install something` outside a virtual environment, the package lands in one shared directory for the whole system or user account. Every project shares that directory. This is fine for exactly one project.

The second project needs a different version of a shared library, and `pip` cheerfully replaces the old one. Project one is now broken, silently, and will stay broken until the next time someone opens it, which in research is roughly eighteen months later, one week before a deadline.

The classic symptoms:

- A script that ran last year fails with an import error today, and nothing in the script changed.
- `pip freeze` prints two hundred packages, of which the project uses nine, and nobody knows which nine.

Modern Linux distributions now refuse global installs with an "externally managed environment" error. That is not the operating system being difficult. That is the operating system having read the incident reports.

## A Python virtual environment in three commands

A virtual environment is just a folder with its own copy of `pip` and its own `site-packages`. Activate it and `python` means that folder's Python; install something and it goes into that folder and nowhere else. Delete the folder and the dependencies vanish.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows the second line is `.venv\Scripts\activate`. That is the whole thing. The `.venv` folder goes in `.gitignore`, because it is a build product, not source, and because committing 400 MB of compiled wheels is how you make someone's `git clone` take longer than their lunch.

## requirements.txt: wish list or lock file?

Here is the part most people get half right. A `requirements.txt` file can mean two completely different things, and the difference is whether the versions are pinned.

| Style | Example line | What it says |
| --- | --- | --- |
| Wish list | `pandas>=2.0` | "Anything from 2.0 onwards, surprise me." |
| Lock | `pandas==2.2.1` | "This exact version. I tested with this one." |

A wish list is what a library author publishes, so their code works alongside whatever else you install. A lock is what an experiment needs, because the point is not flexibility, the point is that running it in 2028 gives the same numbers as in 2026.

The trouble is that the wish list feels more professional. In practice, `pandas>=2.0` means "whichever version was current when the reviewer tried to run it", which is a version you have never seen. When a paper's results differ in the third decimal place on someone else's machine, this is usually the culprit, not the science.

The simplest way to produce a lock is to work inside a virtual environment and then freeze it:

```bash
pip freeze > requirements.lock
```

Tools like `pip-tools`, `uv` and `poetry` do this more cleanly, generating the full pinned list from a short hand-written one. The tool matters less than the habit. Any lock file beats a hopeful one.

## One habit for reproducible research code

Every experiment gets a fresh virtual environment, and the lock file is committed alongside the results it produced. Not the wish list, the lock.

That is the entire habit. When someone opens the repository later, they create an environment, install from the lock, and get the same package versions the author had. Whether the science holds up is a separate question, but at least the argument starts from the same `numpy`.

Without an environment per experiment, packages drift while you work, and the results in the table come from a mix of versions that no file describes. That is where the "unable to reproduce" emails come from. The same discipline that makes [Docker images reproducible](/blog/docker-security-hardening-checklist/) applies here: pin what you tested, not what you hope still works.

## What to remember

- Global `pip install` puts every project in one shared pile, and the pile is never written down.
- `python3 -m venv .venv`, activate, install: three commands, one folder, zero cross-project damage.
- `requirements.txt` with `>=` is a wish list; with `==` it is a lock. Experiments need the lock.
- `pip freeze` from inside a clean environment is the cheapest lock file you will ever make.
- Commit the lock next to the results it produced, and future readers of [my research area](/#research) or anyone else's will thank you.

Reproducibility is mostly the boring discipline of writing down what you did, which is a shame, because "it worked on my machine" is such a satisfying sentence to say to a reviewer.
