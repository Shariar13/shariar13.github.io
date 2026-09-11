---
title: "CTF for Beginners: How to Start Capture The Flag"
date: 2026-02-17
description: "How to start CTF competitions as a beginner: categories, jeopardy vs attack-defence, legal practice platforms, first tools and how to write up solutions."
tags: [Cyber Range, Education, Cybersecurity, Penetration Testing]
---

A classic first CTF challenge goes like this: a web task worth fifty points, the lowest value on the board, described as "easy". The beginner spends three hours on it, tries SQL injection on a form that has no database behind it, and eventually finds the flag by pressing F12 and reading an HTML comment. Someone literally wrote it in the page. Almost everyone who plays CTFs has a story like this, and it is the right way to start.

I was furious, then embarrassed, then, about a day later, hooked. Because that is what a **Capture The Flag (CTF)** competition does: it gives you a puzzle with a definite answer, a scoreboard that does not care about your feelings, and the slow realisation that the tools you have been reading about actually do something when you point them at a target.

This is the guide I wanted at the time. How CTF for beginners actually works, what the categories mean, where you can practise without breaking the law, which tools to open first, and what to do when you have been staring at the same hex dump for two hours.

## What a CTF is: jeopardy vs attack-defence

A CTF is a security competition where the goal is to find hidden strings, the **flags**, usually in a format like `flag{something_here}`, and submit them for points. There are two main formats.

**Jeopardy-style** is a board of independent challenges grouped by category and difficulty. You pick whichever one you like, solve it, submit the flag, move on. This is what almost every beginner event is, and it is the format that lets you specialise in one area while ignoring the rest.

**Attack-defence** gives every team an identical vulnerable server. You patch your own while exploiting everyone else's, and the scoring rewards both. It is chaotic, exhausting, and far more like a real incident than the jeopardy board. Do a few jeopardy events first; attack-defence with no experience is a long weekend of watching your service go down.

## CTF categories and the first tools to open

Most jeopardy boards use the same six or so categories. Here is what each one means and the one or two tools I would open first:

| Category | What you are doing | First tools |
|---|---|---|
| Web | Finding flaws in a web application: injection, broken auth, hidden endpoints | Browser dev tools, Burp Suite Community, `curl` |
| Crypto | Breaking or misusing encryption and encoding, often classical or badly implemented | CyberChef, Python |
| Forensics | Recovering evidence from files, disk images, memory dumps and packet captures | Wireshark, `strings`, `binwalk`, `exiftool` |
| Pwn (binary exploitation) | Exploiting a running program's memory bugs to control it | `gdb` with GEF or pwndbg, pwntools, `checksec` |
| Reverse engineering | Understanding a compiled program without the source | Ghidra, `strings`, `objdump` |
| OSINT | Finding information from public sources: images, usernames, metadata | A search engine, `exiftool`, the Wayback Machine |

Notice how often `strings` appears. Running `strings` on a file and reading the output solves a surprising number of beginner challenges. So does looking at the HTML source, as I learnt the hard way.

Pick one category and stay in it for the first few events. Web and forensics are the friendliest starts: the tools are free, the feedback is immediate, and you do not need to understand the x86 calling convention before you get your first flag. If forensics appeals, [reading a packet capture in Wireshark](/blog/wireshark-packet-capture-basics/) is the skill that unlocks most of that category.

## Practising legally and ethically

The single most important rule: **only attack systems you have explicit permission to attack**. In the UK, unauthorised access to a computer is a criminal offence under the Computer Misuse Act, and "it was a learning exercise" is not a defence. CTF platforms exist precisely so that you never have to guess whether you are allowed.

Good places to start:

- **picoCTF** is run by Carnegie Mellon University and designed for beginners. The challenges stay available after the competition, so you can work through them at your own pace.
- **OWASP Juice Shop** is a deliberately vulnerable web application you run locally. It has its own scoreboard and covers most of the web vulnerabilities you will ever meet.
- **Local virtual machines.** Deliberately vulnerable images you download and run on your own laptop, isolated from your real network.
- **Cyber ranges.** Hosted lab environments that give you a whole isolated network to attack, which I have written about in [what a cyber range is](/blog/what-is-a-cyber-range/).

The ethics extend beyond legality. Do not share flags during a live competition. Do not attack the platform infrastructure. Do not brute-force the submission form. All of these are ways to get banned and, more importantly, to learn nothing.

## A beginner CTF workflow

Here is the loop I teach, which is also, not coincidentally, the loop from my [penetration testing methodology for beginners](/blog/penetration-testing-methodology-for-beginners/) shrunk down to fit a single challenge:

1. **Read the challenge twice.** The title and description are usually a hint. "Ancient Rome" means Caesar cipher. "Look closer" means metadata or steganography.
2. **Identify what you have been given.** Run `file` on it. Is it a PCAP, an ELF binary, a PNG, a URL, a block of base64?
3. **Do the obvious thing first.** `strings`, `exiftool`, view source, CyberChef's "Magic" operation. Beginner flags are often hiding in plain sight.
4. **Form one hypothesis and test it.** Not five. One. Write it down so you know when you have abandoned it.
5. **Timebox.** Thirty to forty-five minutes on a challenge, then switch. Fresh eyes on a different problem beat tired eyes on the same one.
6. **Take notes as you go.** What you tried, what happened, what you ruled out. This becomes your write-up and, more usefully, your memory.
7. **After the event, read other people's solutions** for anything you did not solve. This is where most of the learning happens.

The workflow is the point. Flags are the reward for following it.

## How to write up your solutions

A **write-up** is a short document explaining how you solved a challenge. Writing them is the difference between "I got a flag once" and actually knowing the technique. A good one has:

- The challenge name, category, points and a one-line description.
- What you were given and what you noticed first.
- The steps you took, including the ones that did not work and why.
- The exact commands or code, so someone can reproduce it.
- The flag, redacted if the challenge is still live anywhere.
- One sentence on what you learnt or would do differently.

Keep them somewhere public if the competition allows it. Employers read them, other learners read them, and in six months you will read them yourself and be grateful.

## How lecturers use CTF-style labs on cyber ranges

CTF challenges turn out to be an unusually honest form of assessment, which is why they have crept into university teaching. A flag is either right or wrong. There is no partial credit for a confident essay about SQL injection if you could not perform one.

The way this usually works is on a **cyber range**: an isolated environment where each student gets their own copy of the vulnerable machines, with flags that are unique per student so that copying a friend's answer does not work. The platform logs what each student actually did, which lets the lecturer mark the process, not just the final string, and spot the person who found the flag by guessing. Cyber range platforms of exactly this kind, used for university labs, are part of what I work on.

From the student side, the advice is the same as for public CTFs: read the brief, take notes, and remember that the log is part of the assessment. From the teaching side, the advice is to make the early challenges genuinely easy. The first flag has to be reachable, or the second one never gets attempted.

## Dealing with frustration

You will get stuck. Everyone gets stuck. The difference between people who stay in this field and people who leave is not talent; it is what they do in hour three of being stuck.

Some things that help. Timebox, as above, and mean it. Use hints when the platform offers them; a hint that gets you unstuck teaches more than an evening of nothing. Talk the problem through with someone else, or with a rubber duck, or with the cat. Step away, because the answer often arrives in the shower. And keep a list of "things I did not know", because in a month it will be a list of things you do.

Above all, remember that the fifty-point challenge that took me three hours was, by the standards of the people who built it, trivial. It was not trivial to me. That gap is the entire reason to keep going, and it closes faster than you expect.

## What to remember

- A CTF is a puzzle with a flag; jeopardy boards are independent challenges, attack-defence is live warfare. Start with jeopardy.
- Pick one category, learn its two or three core tools, and stay there for your first few events.
- Only ever attack what you have permission to attack. picoCTF, Juice Shop and cyber ranges exist for this.
- `strings`, `file`, `exiftool` and view-source solve more beginner challenges than any exploit.
- Timebox, take notes, and write up every solve, including the failures.
- Being stuck is the course, not a sign you are failing it.

## Further reading

- [picoCTF](https://picoctf.org/), the beginner-friendly competition and practice platform.
- [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/), the deliberately vulnerable web app to run locally.

Now go and press F12 on something you are allowed to press F12 on.
