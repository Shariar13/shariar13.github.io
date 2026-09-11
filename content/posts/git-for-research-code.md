---
title: "Git for Research Code: Commit Like Someone Will Read It"
date: 2026-01-13
description: "Git for research code: small commits with real messages, branches for experiments, tags for the paper version, and a .gitignore that keeps secrets out."
tags: [DevOps, Research, Python]
---

Every research group has a folder that looks like this: `train.py`, `train_v2.py`, `train_v2_fixed.py`, `train_final.py`, `train_final_v3_REAL.py`, and a file called `train_final_v3_REAL_backup.py` that nobody dares delete. Somewhere in there is the version that produced Table 2. Nobody knows which one.

This is version control done by hand, with filenames as commit messages. It works about as well as arithmetic done by hand with a pen you found on the floor.

Git for research code does not need to be sophisticated. It needs to answer three questions: what changed, why, and which version made the numbers in the paper. Most research repositories answer none of them, and the future reader is usually the author.

## Why research code turns into final_v3_REAL.py

Research code is exploratory. You try something, it half works, you copy the file so you can try something else without losing the half that worked. The instinct is correct. The tool is wrong.

Copying files loses the one thing that matters: the relationship between versions. `train_v2.py` and `train_final.py` differ in forty lines, and there is no record of whether the change was "fixed the bug" or "accidentally deleted the normalisation step". A diff tool can tell you the lines. Nothing can tell you the reason.

Git stores the diff and the reason together, if you let it. But it only records what you tell it, and "wip" is not a reason.

## Small commits with real commit messages

The classic mistake is one commit a week called "updates", containing a bug fix, a new feature, three experiments and new plot colours. When one of them breaks the results, you get to bisect by hand.

A commit should be one change, small enough that the message can describe it honestly:

```bash
git add src/preprocess.py
git commit -m "Normalise features before split, not after (leaked test stats)"
```

The first half says what changed. The bracket says why, and it is the sort of why that makes a future reader check their own code. Compare with `git commit -m "fix"`, which says something was once broken and now, perhaps, is not.

Rules of thumb:

- One idea per commit. If you need the word "and" in the message, that is two commits.
- Imperative mood, under about 70 characters: "Add", "Fix", "Remove", not "Added stuff".
- Say why when the why is not obvious. The what is already in the diff.

## Branches for experiments, tags for the version in the paper

Branches are how you stop copying files. Want a different loss function? Make a branch called `exp/focal-loss`, hack away, and either merge it or delete it. `main` stays as the version that works, and the history stays intact.

Tags are the part almost everyone skips. When you submit a paper, tag the exact commit that produced the results:

```bash
git tag -a paper-v1 -m "Results as submitted, March 2026"
git push origin paper-v1
```

Six months later, half the codebase has changed, and `git checkout paper-v1` puts you back exactly where the numbers came from. Without the tag you are doing archaeology. With it you are a person running a command. Pair the tag with a pinned environment and the whole thing actually reproduces.

## Never commit data or secrets: the .gitignore that saves you

Two things must never enter a Git repository: large data files and credentials. Data because Git keeps every version forever, and a 2 GB dataset committed once makes every clone 2 GB forever. Credentials because repositories go public and history goes with them. Deleting the key in a later commit does not remove it from the earlier one.

A minimal `.gitignore` for a Python research project:

```gitignore
.venv/
__pycache__/
data/
outputs/
*.ckpt
*.pth
.env
```

The `.env` line is the one that prevents the incident. Put API keys in that file, load them from environment variables, and let `.gitignore` make committing them impossible. If a secret has already reached a public repository, rotate it immediately; a bot copied it within minutes anyway. This is the same category of mistake as [the script that went rogue](/blog/the-day-my-python-script-went-rogue/): automation faithfully doing exactly what you told it, which was the problem.

## The one-line README that saves a future reader

A README has to answer "how do I run this" before the reader gives up. One line is enough:

```text
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.lock && python train.py --config configs/paper.yaml
```

That line names the config that produced the paper, the lock file, and the entry point. It is also the first thing to go stale, so run it before pushing the tag. Work in [my research area](/#research) only matters if someone can eventually run the code, and the README is where they decide whether to bother.

## What to remember

- Filenames are not version control. `final_v3_REAL.py` is a diff with no reason attached.
- One idea per commit, imperative message, say why when the why is not in the diff.
- Branches for experiments, `main` for what works, and delete the branches that did not.
- Tag the commit behind every submitted paper. Future you will run `git checkout paper-v1` and weep with relief.
- `.gitignore` data, model weights, `.venv/` and `.env`. Secrets in history are secrets forever.

Git has a learning curve, but so does explaining to a reviewer why the numbers in Table 2 came from a file called `backup_of_backup.py`.
