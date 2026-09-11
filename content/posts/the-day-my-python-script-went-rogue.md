---
title: "The Day My Python Script Went Rogue: Safe Automation Rules"
date: 2026-03-31
description: "How to write safe Python automation scripts: idempotency, dry-run flags, confirmations, explicit paths, logging, retries with backoff and cron file locks."
tags: [Python, DevOps, Cybersecurity]
---

I asked Python to automate a weekly report. It automated my sanity instead. The script was supposed to collect last week's PDFs, zip them, email the archive and tidy up the working folder. It did three of those. The "tidy up" step ran `shutil.rmtree` on a relative path, from a working directory that was not the one I had tested in, and deleted the folder containing every report from the previous term.

Then cron ran it again an hour later, because I had scheduled it hourly "for testing" and forgotten. The second run found nothing to delete and reported success, which was at least honest.

Everything about that script was quick. It took twenty minutes to write and about two days to recover from, plus a conversation with a colleague who kept saying "but you do security" in a tone I have chosen to remember as supportive. This post is the set of rules I now apply to every automation script, however quick, and a Python skeleton that has them built in.

## Idempotency: running it twice should be safe

An **idempotent** script produces the same end state whether you run it once or five times. Moving a file that has already been moved is a no-op, not an error and not a duplicate. Creating a directory that exists is fine. An email already sent is skipped because the script checks a marker first.

Idempotency is what saves you when cron overlaps, when a network blip makes you rerun, or when you are unsure whether the last run finished. It is mostly a habit of checking state before acting: "does the destination already exist?" before "move". The alternative is a script that is only safe to run exactly once, which is a script that is not safe.

## Dry-run flags and confirmations for destructive actions

Every script that deletes, moves, overwrites or sends should have a `--dry-run` mode that logs what it *would* do and does nothing. I would argue the dry run should be the default, with `--apply` required for changes, but at minimum the flag must exist and you must actually use it.

Destructive steps get a second gate: an explicit confirmation. Print the plan, ask for a `yes`, and provide a `--yes` flag so that for unattended runs the confirmation is a decision made when you scheduled the job. The old draft of my script had a retry loop with no limit. `while True` is both powerful and dangerous. Handle with caffeine and a maximum attempt count.

## Explicit paths: never rm on a relative path

The root cause of my disaster was `Path("output")`. Relative to what? Relative to wherever the process happened to start, which under cron is the user's home directory, not the project folder I had tested from.

Rules that would have saved me:

- Build every path from an absolute base (`Path("/srv/reports")`) or from `Path(__file__).resolve().parent`, never from the current working directory.
- Call `.resolve()` and, before anything destructive, abort if the result is not inside the base directory.
- Never delete a directory you did not create in the same run. Move things to a dated `trash/` folder and purge it separately, later. Deletion is cheap to postpone and expensive to reverse.

This is the automation equivalent of scope in a [penetration test](/blog/penetration-testing-methodology-for-beginners/): decide what the script is allowed to touch, write it down, and check every action against it.

## Logging, timeouts and retries with backoff

If my script had logged the absolute path it was about to remove, I would have seen `/home/shariar/output` and stopped. Logging is not for after the disaster; it is so there is a moment before the disaster where you can notice. Log at INFO what the script is doing, at WARNING when it skips something, and at ERROR when it gives up. Write it to stderr with timestamps and let cron capture it.

Network calls need a **timeout**, always. `requests.get(url)` with no timeout can hang forever, and a script hanging forever under cron is a script that never releases its lock and never runs again.

Retries need **backoff** and a cap. Retry in a tight loop and you get my other famous incident, where a "quick" script sent a hundred thousand requests a minute to an internal HR server and the IT department flagged me as a security incident. Exponential backoff with jitter is short to write:

```python
import random
import time


def with_retries(fn, attempts=5, base=1.0):
    for n in range(attempts):
        try:
            return fn()
        except (ConnectionError, TimeoutError) as exc:  # only the errors you expect
            if n == attempts - 1:
                raise
            delay = base * (2 ** n) + random.uniform(0, 0.5)
            print(f"attempt {n + 1} failed ({exc}); retrying in {delay:.1f}s")
            time.sleep(delay)
```

Five attempts, delays of roughly one, two, four and eight seconds between them. The jitter stops a fleet of scripts retrying in lockstep.

## Cron gotchas: environment, PATH, overlap and locks

Cron is where working scripts go to fail in new ways.

- **Environment.** Cron does not load your shell profile: `PATH` is minimal, no virtual environment is active and nothing from `.bashrc` exists. Use absolute paths to the interpreter (`/srv/reports/.venv/bin/python`) and read configuration from an explicit file.
- **Working directory.** It is the user's home, not your project. See the disaster above.
- **Overlapping runs.** If the job takes longer than the interval, cron starts another one. Two instances moving the same files is how you get half-moved files and duplicate emails.
- **Silent failure.** Output goes to local mail nobody reads. Redirect stdout and stderr to a log file, and make the script exit non-zero on failure so something can alert on it.

The fix for overlap is a **file lock**. The script takes an exclusive lock on a known file at startup; if the lock is already held, it exits immediately. `flock` in the shell does this, and so does `fcntl.flock` in Python, which the skeleton below uses.

## Least privilege for service accounts

The script ran as me, with my permissions, which included the ability to delete every folder I could see. It needed to read one directory and write to two.

Automation should run as a dedicated service account that can only reach the paths and services it needs. On Linux that means a user with no login shell, ownership of its working directories and nothing else. For API access, a token scoped to the specific operations, not an admin key. If the script is compromised or simply wrong, the damage is bounded by what the account can do. Mine could do anything, and so it did. It is the same least-privilege principle I spend my research time on for [Zero Trust in 6G networks](/#research), applied to a cron job.

## A safe automation script skeleton

Here is the shape I now start from. Dry run, confirmation, absolute paths with a containment check, logging, idempotent moves and a file lock:

```python
#!/usr/bin/env python3
"""Archive last week's report PDFs. Refuses to act outside ARCHIVE."""
import argparse
import fcntl
import logging
import shutil
import sys
from pathlib import Path

REPORTS = Path("/srv/reports/outbox").resolve()
ARCHIVE = Path("/srv/reports/archive").resolve()
LOCK_PATH = Path("/run/lock/archive-reports.lock")

log = logging.getLogger("archive")


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true", help="log actions without performing them")
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    return p.parse_args()


def acquire_lock():
    handle = LOCK_PATH.open("w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log.error("another run holds %s; exiting", LOCK_PATH)
        sys.exit(1)
    return handle  # keep it referenced; the lock is released when it closes


def plan_moves():
    moves = []
    for src in sorted(REPORTS.glob("*.pdf")):
        dst = (ARCHIVE / src.name).resolve()
        if not dst.is_relative_to(ARCHIVE):
            log.error("refusing to write outside %s: %s", ARCHIVE, dst)
            sys.exit(2)
        if dst.exists():
            log.info("skip %s (already archived)", src.name)
            continue
        moves.append((src, dst))
    return moves


def confirm(count):
    if not sys.stdin.isatty():
        log.error("no terminal for confirmation; pass --yes for unattended runs")
        sys.exit(3)
    return input(f"Move {count} file(s)? [yes/N] ").strip() == "yes"


def main():
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    lock = acquire_lock()  # must stay referenced until exit

    moves = plan_moves()
    if not moves:
        log.info("nothing to do")
        return

    for src, dst in moves:
        log.info("%s %s -> %s", "DRY RUN" if args.dry_run else "PLAN", src, dst)
    if args.dry_run:
        return
    if not args.yes and not confirm(len(moves)):
        log.warning("aborted by user")
        return

    ARCHIVE.mkdir(parents=True, exist_ok=True)
    for src, dst in moves:
        shutil.move(src, dst)
        log.info("moved %s", src.name)


if __name__ == "__main__":
    main()
```

Note what is not in it: no `rmtree`, no relative paths, no unbounded loop. (`Path.is_relative_to` needs Python 3.9 or later.) The cron line that runs it is equally boring:

```bash
0 6 * * 1  /srv/reports/.venv/bin/python /srv/reports/archive.py --yes >> /var/log/archive-cron.log 2>&1
```

Absolute interpreter, absolute script, explicit `--yes` because the confirmation was made when I wrote this line, and output captured somewhere I will actually look.

## What to remember

- Make scripts idempotent: check state before acting, so a rerun is harmless.
- Give every destructive script a `--dry-run` and use it. Confirm destructive steps unless `--yes` is passed deliberately.
- Build paths from an absolute base, resolve them, and check they stay inside the directory you expect. Never `rm` a relative path.
- Log the absolute path of everything you are about to touch. Add timeouts to network calls and bounded retries with backoff.
- Under cron: absolute paths, explicit environment, a file lock against overlapping runs, output redirected to a log.
- Run automation as a service account that can only touch what it needs.

## Further reading

- [Python argparse documentation](https://docs.python.org/3/library/argparse.html) for the flag handling used above.
- [Python fcntl documentation](https://docs.python.org/3/library/fcntl.html) for the file-lock call.

The report now arrives every Monday at 06:00. I have not read one since, but at least nothing is being deleted while I don't.
