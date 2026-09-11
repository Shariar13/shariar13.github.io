---
title: "Digital Forensics Basics: Hashing and Chain of Custody"
date: 2026-04-14
description: "Digital forensics fundamentals: bit-for-bit imaging, write blockers, SHA-256 hashing, chain of custody, order of volatility, why evidence gets thrown out."
tags: [Digital Forensics, Cybersecurity, Education]
---

The classic student "forensic" acquisition is a `dd` command typed with the `if=` and `of=` arguments the wrong way round. The evidence drive is not imaged. A blank image is written onto it. In a teaching lab the drive is a practice USB stick with nothing on it, which is the only reason this is a joke in a lecture rather than a career-ending cautionary tale.

That mistake is the whole discipline in miniature. Digital forensics is not about clever tools. It is about being able to prove, to a sceptical stranger, that what you are holding is exactly what you collected, that nobody changed it, and that you can show your working for every step in between. The tools are the easy part.

So here are the digital forensics fundamentals I wish someone had made me write out before letting me near a drive: acquisition, hashing, chain of custody, and the handful of ways a perfectly good piece of evidence ends up unusable.

## Acquisition: bit-for-bit images and write blockers

The first rule is that you do not work on the original. You make a **bit-for-bit image**: a copy of every sector of the storage device, including the empty space, the deleted files and the bits between partitions. A file-level copy misses all of that, and "all of that" is usually where the interesting things are.

The second rule is that you do not let the original change while you copy it. Plugging a drive into a normal computer mounts it, and mounting writes things: journal updates, access timestamps, the operating system's helpful little index files. A **write blocker** sits between the evidence drive and your workstation and physically refuses write commands. Hardware blockers are the standard; software blockers exist but need you to trust the operating system to behave, which in my experience is a lot to ask.

The tools are not exotic. `dd` will do it. `dc3dd` and `dcfldd` are forensic variants that hash as they copy and log what they did. FTK Imager and Guymager wrap the same idea in a GUI and can write the Expert Witness (E01) format, which stores the hash and case notes alongside the data. Whichever you use, the output is the same: one file that is, sector for sector, the drive.

## Hashing for integrity: SHA-256 and why MD5 collisions matter

A cryptographic hash turns any input into a fixed-length fingerprint, and changing a single bit of the input changes the fingerprint completely. That gives forensics its central proof: hash the source, hash the image, and if the two match, the image is faithful. Hash the image again a year later and if it still matches, nobody touched it.

Here is the whole workflow in bash, with the write blocker in place and the evidence drive showing up as `/dev/sdb`:

```bash
# Image the drive, carrying on past read errors and padding them with zeros
sudo dd if=/dev/sdb of=evidence.dd bs=4M conv=noerror,sync status=progress

# Hash the source and the image; the two digests must match
sudo sha256sum /dev/sdb evidence.dd

# Record the image hash, and verify it any time later
sha256sum evidence.dd > evidence.dd.sha256
sha256sum -c evidence.dd.sha256
```

If the drive had unreadable sectors, `conv=noerror,sync` fills them with zeros and the two hashes will not match. That is not a failure. It is something you write down, with the sector count, because "the hashes differ and here is exactly why" is defensible and "the hashes differ" on its own is not.

Why SHA-256 rather than MD5? MD5 has known **collisions**: researchers can construct two different files with the same MD5 digest. That does not mean someone can quietly alter your specific image and keep its hash, which is a harder problem. But it means an opposing expert can stand up and say "MD5 is broken", and the jury hears "broken", not the nuance. SHA-1 has gone the same way. Use SHA-256, and if a tool insists on MD5, record both. Two hashes are cheap; an argument about one is not.

## Chain of custody: who had it, when, and why

**Chain of custody** is the documented history of a piece of evidence from the moment it was collected to the moment it is presented. Every hand it passed through, every location it sat in, every action taken on it. The point is that at any moment you can answer "who could have altered this?" with a list of names rather than a shrug.

The form is boring on purpose. Something like this, one row per event:

| Date/time (UTC) | Item | Action | From | To | Location | SHA-256 (first 16) | Signature |
|---|---|---|---|---|---|---|---|
| 2026-04-14 09:12 | HDD-01, 1 TB SATA | Seized, bagged, sealed | Office 3.14 | S. Kabir | Evidence bag E-0417 | n/a (not yet imaged) | SK |
| 2026-04-14 10:40 | HDD-01 | Imaged via write blocker | S. Kabir | S. Kabir | Forensics lab | 9f2a...c41d | SK |
| 2026-04-14 11:05 | HDD-01 | Returned to secure storage | S. Kabir | Evidence locker | Locker B, shelf 2 | 9f2a...c41d | SK |
| 2026-04-16 14:20 | IMG-01 (evidence.dd) | Hash verified before analysis | Locker B | Analyst workstation | Forensics lab | 9f2a...c41d | SK |

Every gap in that table is a question a lawyer will ask. Every hash that changes between rows is a question you cannot answer. The table is not bureaucracy for its own sake; it is the thing that makes the technical work admissible.

## Order of volatility: what to collect first

Not all evidence waits for you. RAM contents vanish at power-off. Network connections close. Temporary files get cleaned up. The **order of volatility**, set out in RFC 3227, says collect the most short-lived things first:

1. CPU registers and cache (in practice, you will not get these)
2. Memory, running processes, network connections, routing and ARP tables
3. Temporary file systems and swap
4. The disk itself
5. Remote logs and monitoring data held elsewhere
6. Physical configuration and network topology
7. Archival media and backups

The practical consequence is that "pull the plug" is not always the right first move. Pulling the plug preserves the disk perfectly and destroys the memory completely, and memory is where the running malware, the decrypted keys and the open sessions live. Capturing memory changes the system, so you document what you ran and when, and you accept the trade. Non-volatile evidence can wait an hour. Volatile evidence cannot wait a minute.

## Timelines and documentation

Once you have images, the work is mostly building a **timeline**: what happened, in what order. File systems record several timestamps per file, usually modification, access, metadata change and creation, and tools such as Plaso can merge those with browser history, event logs and registry entries into one ordered list.

Timelines are where cases are won and where beginners come unstuck, for two boring reasons. The first is time zones: a log in local time, a file system in UTC and an email header in the sender's zone will happily tell three different stories. Normalise everything to UTC and write down that you did. The second is clock drift: the machine's clock was wrong, so every timestamp is offset. Note the offset at acquisition and carry it through.

Documentation is the rest of it. Contemporaneous notes, meaning written at the time, not reconstructed the night before the report. Tool versions. Commands run, with output. Photographs of the physical setup. If a step is not written down, then as far as anyone else is concerned, it did not happen.

## How digital evidence gets thrown out

The failure modes are well known and almost all of them are procedural:

- **Working on the original.** The moment you mount it read-write, the "unaltered" argument is gone.
- **No hash, or a hash that does not match** with no explanation.
- **A gap in the chain of custody.** Twelve hours in a car boot that nobody logged.
- **Contamination.** Booting the suspect machine "just to have a look" rewrites hundreds of files.
- **Exceeding authorisation.** A warrant or engagement letter for one machine does not cover the one next to it.
- **Unvalidated tools.** If you cannot say how the tool works and that it was tested, its output is a claim, not a finding.
- **The examiner cannot explain it.** Every conclusion must survive a plain-English "how do you know?".

None of these are technical. All of them come down to habits, which is why the discipline spends so much time on forms.

## Where image forensics fits into a wider investigation

I spend most of my research time on a narrow corner of this field: deciding whether a photograph was made by a camera or a generative model, which is my own research area in one sentence. It is easy to think of that as a self-contained problem. It is not.

An image detector answers one question about one file. An investigation needs to know where that file came from, when it arrived, who sent it, whether the copy being analysed is the copy that was collected, and whether the analysis method can be explained and reproduced. Those are acquisition, timeline, chain of custody and documentation again. The classifier is a witness; the process is what makes the witness credible. If you want the technical side of that witness, [how to spot AI-generated images](/blog/how-to-spot-ai-generated-images/) covers what the detectors actually measure, and the broader [research overview](/#research) shows where it sits alongside the rest.

## What to remember

- Never work on the original. Image it bit-for-bit through a write blocker, then work on the image.
- Hash the source and the image with SHA-256, record the digests, and re-verify before every analysis.
- Chain of custody is a complete, gap-free record of who held the evidence, when, where and why.
- Collect volatile evidence (memory, connections) before non-volatile evidence (disk, backups).
- Normalise timelines to UTC, note clock offsets, and keep contemporaneous notes.
- Most evidence is thrown out for procedural reasons, not technical ones.

## Further reading

- [NIST SP 800-86, Guide to Integrating Forensic Techniques into Incident Response](https://csrc.nist.gov/pubs/sp/800/86/final), the standard reference for the process side.

Check your `if=` and `of=` twice. Then check them again. The drive does not care how confident you felt.
