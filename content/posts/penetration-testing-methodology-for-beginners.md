---
title: "Penetration Testing Methodology for Beginners: Scope to Report"
date: 2026-01-06
description: "A beginner's penetration testing methodology: authorisation and scope first, then recon, enumeration, exploitation and the report that is the product."
tags: [Penetration Testing, Cybersecurity, Education]
---

The first thing a new student asks in my labs is "can I hack the university Wi-Fi?" The answer is no, followed by a short explanation of the Computer Misuse Act, followed by the same student asking whether their landlord's router counts. It does not count either.

I understand the impulse. Penetration testing looks like the exciting part of cybersecurity, the tools are free, and every tutorial starts with `nmap` and skips the paperwork. But the paperwork is the job. A penetration test without authorisation is not a penetration test. It is a crime with a nicer name.

So this is a penetration testing methodology for beginners in the order that professionals actually do it: permission first, technique second, report last and most important. If you only read one section, read the first one.

## Authorisation and scope come before everything

Before you send a single packet, you need three things in writing.

**Authorisation.** Someone with the authority to grant it has told you, in a document, that you may test these specific systems. Not a verbal "sure" from a manager. A signed document that names the systems and the dates.

**Scope.** Exactly which IP ranges, domains, applications and accounts are in bounds, and which are explicitly out. Third-party hosting, shared infrastructure and anything the client does not own are the usual traps. A cloud provider's load balancer is not yours to test just because the client's app sits behind it.

**Rules of engagement.** When you may test (business hours or not), what you may do (is denial of service allowed? social engineering? physical access?), who to call when something breaks, and how you will handle any data you find.

In the UK the legal backdrop is the **Computer Misuse Act 1990**. Its first offence is unauthorised access to computer material, and it does not require that you did any damage or even that you got in. Attempting to access a system you were not permitted to access is enough. "I was only checking" is not a defence anywhere.

I will say it plainly because it matters: **only test systems you are authorised to test.** Your own machines, a lab you own, a [cyber range](/blog/what-is-a-cyber-range/) built for the purpose, or a client who has signed for it. Nothing else.

## The phases of a penetration test

Most methodologies, including the two linked at the end, describe the same phases.

1. **Reconnaissance.** Learn about the target without touching it, or touching it only as a normal user would. Public DNS records, certificate transparency logs, job adverts that mention the tech stack, the company's own documentation. The goal is a map before you start knocking on doors.
2. **Scanning and enumeration.** Now you touch it. Which hosts are alive, which ports are open, what software is listening and which version. Enumeration goes deeper: user lists, share names, directory structures, API endpoints.
3. **Vulnerability analysis.** Match what you found to known weaknesses. Outdated versions, default credentials, misconfigurations, the OWASP Top 10 for anything with a web front end. This is thinking time, not tool time.
4. **Exploitation.** Prove the vulnerability is real by using it, within the rules of engagement. The goal is evidence, not damage. A screenshot of a low-privilege shell is worth more than a crashed server.
5. **Post-exploitation.** What does that access actually give an attacker? Can you move to another host, escalate to administrator, reach the data that matters? This is where impact is established.
6. **Reporting.** Write it all down for someone who will fix it. More on this below, because it is the whole point.

Beginners live in phases 2 and 4 because those are where the tools are. Professionals spend disproportionate time in 1, 3 and 6.

## Reconnaissance and scanning with nmap

Every course starts with `nmap` and so will I, but with the version I actually run rather than the one-liner from the tutorial:

```bash
nmap -sV -sC -p- --min-rate 1000 -oA scans/target-initial 10.10.5.20
```

Piece by piece:

- `-sV` probes open ports to identify the service and version.
- `-sC` runs the default script set, which picks up things like anonymous FTP, HTTP titles and TLS certificate details.
- `-p-` scans all 65,535 TCP ports, not just the top thousand.
- `--min-rate 1000` speeds things up on a lab network; on a production engagement you may need to go slower, per the rules of engagement.
- `-oA scans/target-initial` writes normal, XML and grepable output with that prefix.

Two habits to build now. First, the target IP goes in a scope file, and you check that file before every command, because a typo in the last octet is how people scan the wrong company. Second, never scan anything not in that file, including out of curiosity, including "just a ping".

## Enumeration and vulnerability analysis: where the thinking happens

Once you have a port list, resist the urge to throw exploits at it. Enumerate. If port 80 is open, browse the site as a user first. Read `robots.txt`. Look at the page source. Find the login form and note what error it gives for a wrong username versus a wrong password. If SMB is open, list the shares.

Then analyse. For each service, ask: what version is this, are there known vulnerabilities, is it configured badly, does it trust input it should not? The OWASP Web Security Testing Guide is a checklist for the web part of this, and it is long because the web is long. Work through the sections that apply and write down what you checked, even when you found nothing. "Tested for X, not vulnerable" is a finding too.

## Note-taking is the skill nobody teaches

You will run hundreds of commands over an engagement and remember about six of them. Everything else has to be written down at the time, not reconstructed on the last day from shell history and regret.

My minimum:

- A running log with a timestamp, the command, and one line on why you ran it.
- Every scan saved to a file with a meaningful name.
- A screenshot the moment anything works, with the terminal showing the date and target.
- A separate "findings so far" file, updated as you go, so the report is half written before you start it.

The timestamps are not bureaucracy. If the client's monitoring alerts at 14:32 and you can show what you were doing at 14:32, the conversation is short. If you cannot, it is not.

## The report is the product

Nobody is paying for the shell. They are paying for the document that tells them what is wrong, how bad it is and what to do. A brilliant test with a bad report has the value of a bad test.

A workable report structure:

1. **Executive summary.** One page, no jargon. What was tested, the overall risk level, the three things to fix first.
2. **Scope and methodology.** What was in and out of scope, the dates, the rules of engagement, the approach taken. This is where the authorisation is referenced.
3. **Findings.** One entry per issue, each with: title, severity, affected systems, description, evidence (the screenshot), impact in plain words, and a specific remediation. Order by severity.
4. **Attack narrative.** For serious findings, the chain: how recon led to enumeration led to the foothold led to the data. This is what convinces people the risk is real.
5. **Appendices.** Full scan output, tool versions, and the list of everything tested that was not vulnerable.

Write findings for the developer or administrator who will fix them. "Vulnerable to SQL injection" is a headline. "The `q` parameter on `/search` is concatenated into a query; use parameterised statements, example in the appendix" is a finding.

## Where to practise legally

None of this becomes real until you do it, and you cannot do it on systems you do not own. The good news is that legal practice is abundant.

- **Cyber ranges and lab platforms** built for exactly this. I built [CyberRange.world](/#research) for university lab sessions, and wrote about [what a cyber range is](/blog/what-is-a-cyber-range/) and how to design an exercise for one.
- **Capture-the-flag competitions**, which are explicitly designed to be attacked and usually publish a scope and rules.
- **Your own lab.** Two virtual machines on an isolated virtual network; deliberately vulnerable images exist for exactly this.
- **Bug bounty programmes**, but only after reading the programme's scope with the same care as a contract, because it is one.

Whichever you choose, practise the whole methodology: scope statement first, notes throughout, a short report at the end. The tools are the least of it.

## What to remember

- Authorisation, scope and rules of engagement come first, in writing. Without them it is an offence, not a test.
- The phases are recon, scanning and enumeration, vulnerability analysis, exploitation, post-exploitation, reporting. Beginners over-invest in the middle two.
- Enumerate before you exploit. Thinking beats tooling.
- Take timestamped notes as you go; the report is the product and it is built from them.
- Practise on cyber ranges, CTFs and your own lab. Only test systems you are authorised to test.

## Further reading

- [Penetration Testing Execution Standard (PTES)](http://www.pentest-standard.org/) for the full phase model and what each phase should produce.
- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) for the web application checklist.

The landlord's router is still off limits. Ask them to change the default password instead; that is a finding, and it is free.
