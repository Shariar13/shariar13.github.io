---
title: "Wireshark Packet Capture Basics: Reading Your First PCAP"
date: 2026-01-27
description: "Wireshark packet capture basics: capture vs display filters, the TCP three-way handshake, following streams, finding retransmissions and tshark."
tags: [Cybersecurity, Digital Forensics, Education]
---

The first time most people open Wireshark, they click the little shark fin next to the Wi-Fi interface, watch about four thousand rows scroll past in the time it takes to blink, and close the window in mild panic. Then they decide packet analysis "isn't really their thing", which is a shame, because the panic is entirely fixable with two filters and one habit.

The problem was not Wireshark. The problem was that I had no question. A packet capture is every conversation on a wire, in order, with nothing hidden. Without a question, it is a phone book. With one, it is the most honest witness you will ever interview, because packets do not remember things differently from how they happened.

So this is a beginner's guide to Wireshark packet capture basics: how to filter, how to read a TCP conversation, how to recognise the protocols you will meet most often, and how to do all of it without ending up in a meeting with someone from legal.

## Capture filters vs display filters

Wireshark has two kinds of filter, and mixing them up is the first mistake everyone makes, myself included.

A **capture filter** is applied while packets are being recorded. It uses the older BPF syntax from tcpdump, such as `host 10.0.0.5` or `port 53`, and anything that does not match is thrown away before it ever reaches disk. That is efficient, and also permanent. If you capture only port 53 and later realise the interesting traffic was on port 443, there is no undo.

A **display filter** is applied after the fact to a capture you already have. It uses Wireshark's own syntax, such as `ip.addr == 10.0.0.5` or `tcp.port == 443`, and it hides rows rather than deleting them. Change your mind and the packets are still there.

My rule for beginners: capture broadly, with at most a coarse capture filter to exclude your own noise, and do all the thinking with display filters. Disk is cheap. Recapturing the exact moment a bug happened is not.

## The TCP three-way handshake, packet by packet

Almost every conversation you care about starts the same way. Filter for `tcp.flags.syn == 1` and you will see it:

1. **SYN** from the client: "I would like to talk. My starting sequence number is X."
2. **SYN, ACK** from the server: "Fine. My starting number is Y, and I acknowledge X plus one."
3. **ACK** from the client: "Acknowledged. Let us begin."

Wireshark shows these in the Info column as `[SYN]`, `[SYN, ACK]` and `[ACK]`, and by default it rewrites the sequence numbers relative to the start of the connection, so the first one reads `Seq=0` rather than a random 32-bit value. That is a display convenience, not what is on the wire, which matters the moment you compare notes with someone using a different tool.

Once you can spot a handshake, you can spot the absence of one. A SYN with no SYN-ACK means nothing is listening, or a firewall ate it. A SYN answered by RST means something is listening and does not want to talk to you. Both are diagnoses, and neither needed a support ticket.

## Following a TCP stream

Individual packets are a terrible way to read a conversation. Right-click any packet and choose **Follow > TCP Stream**, and Wireshark reassembles the whole exchange into one window, client traffic in one colour and server traffic in another. For plain HTTP this shows you the request headers, the response, and the HTML, exactly as the two programs saw it.

This is also the point where you discover how much of the internet still sends things in the clear. The first time a student follows a stream and reads a login form field in plaintext, they usually go a bit quiet. That is the correct reaction.

Following a stream applies a display filter like `tcp.stream eq 4` behind the scenes. Clear it when you are done, or you will spend ten minutes wondering where all the other packets went. I mention this for no personal reason at all.

## Spotting DNS, HTTP and TLS in a capture

Three protocols make up most of what a beginner needs to recognise:

- **DNS** is usually UDP port 53, a query followed by a response. The filter `dns` shows both, and `dns.qry.name` tells you what was asked for. A capture's DNS queries are a surprisingly complete list of everything the machine tried to talk to.
- **HTTP** is TCP port 80, unencrypted, and fully readable. `http.request` shows every request line; `http.response.code == 500` shows the server having a bad day.
- **TLS** is what HTTPS runs on, normally TCP port 443. You cannot read the payload, but the handshake is visible, and the Client Hello usually carries the server name in plaintext. `tls.handshake.type == 1` picks out Client Hellos, which tells you where a machine connected even when you cannot see what it said.

If you want to know what happens inside that handshake, I wrote it up in [how the TLS handshake works](/blog/tls-handshake-explained/). The short version: the bit you can see in Wireshark is the negotiation, and the bit you cannot see is the point.

## Useful Wireshark display filters to memorise

You need far fewer filters than the documentation suggests. These cover most of a working day:

- `ip.addr == 192.168.1.10`: anything to or from one host
- `tcp.port == 443` or `udp.port == 53`: one port, either direction
- `http.request`: every HTTP request
- `http.request.method == "POST"`: only the ones that submit data
- `tls.handshake`: the visible part of every TLS session
- `dns.flags.response == 0`: DNS queries only
- `tcp.flags.syn == 1 && tcp.flags.ack == 0`: connection attempts
- `tcp.analysis.flags`: everything Wireshark thinks is wrong
- `!(arp || icmp)`: hide the background chatter
- `frame contains "password"`: for the moment you stop trusting the application

Combine them with `&&`, `||` and `!`. Wireshark colours the filter bar green when the syntax is valid and red when it is not, which is more feedback than most compilers give.

## Finding retransmissions and other problems

The filter `tcp.analysis.retransmission` shows segments that had to be sent again because no acknowledgement arrived. A handful over a long capture is normal. Clusters of them, or the pattern of retransmission, duplicate ACK, retransmission, is packet loss, and packet loss is the reason "the network is slow" is the most common half-truth in IT.

`tcp.analysis.zero_window` is the other one worth knowing. It means the receiver's buffer is full and it has told the sender to stop. That is not the network at all. It is an application that cannot read fast enough, which changes who gets the bug report.

For a summary, **Analyze > Expert Information** groups every warning Wireshark noticed, and **Statistics > Conversations** shows who talked to whom and how much. Between them, you can usually answer "what is this machine doing" in about five minutes.

## Exporting objects and scripting with tshark

Wireshark can rebuild files that crossed the wire. **File > Export Objects > HTTP** lists every image, script and document transferred over plain HTTP in the capture and lets you save them. In a forensics context this is how you recover what was downloaded; in a teaching context it is how you demonstrate why unencrypted downloads are a bad idea.

When you have fifty captures instead of one, the GUI stops being the right tool. Wireshark ships with **tshark**, a command-line version that takes the same display filters and prints the fields you choose:

```bash
tshark -r capture.pcapng -Y "dns.flags.response == 0" \
  -T fields -e frame.time -e ip.src -e dns.qry.name
```

That prints one line per DNS query with the time, the source host and the name asked for, which you can pipe into `sort | uniq -c` and suddenly you have a report. Anything you can filter in the GUI, you can script in tshark, and anything you can script can run overnight.

## Never capture on networks you do not own

Wireshark shows everything on the segment, including other people's traffic. On a network you administer, that is monitoring. On a coffee shop's Wi-Fi, or a university's, or your employer's without written permission, it is interception, and in the UK unauthorised interception of communications is a criminal offence. The tool is neutral. The circumstances are not.

Practise on your own machine, on a lab virtual machine, or on the sample captures that the Wireshark wiki publishes for exactly this purpose. Most of the traffic I look at for [my research](/#research) comes from lab networks built to be looked at. If you are working through a structured approach, the reconnaissance stage in my [penetration testing methodology for beginners](/blog/penetration-testing-methodology-for-beginners/) says the same thing with more emphasis: scope and authorisation come first, and the interesting tools come second.

## What to remember

- Capture filters throw packets away permanently; display filters only hide them. Capture broadly, filter later.
- Every TCP conversation starts with SYN, SYN-ACK, ACK. Learn to see it and you can see when it fails.
- Follow TCP Stream turns packets back into the conversation the applications actually had.
- DNS tells you where a machine tried to go; TLS Client Hellos tell you where it actually connected.
- `tcp.analysis.flags` and Expert Information find most problems for you; tshark lets you script the search across many captures.
- Only capture where you have permission. Packets are evidence, and so is capturing them.

## Further reading

- [Wireshark official documentation](https://www.wireshark.org/docs/), including the user guide and the display filter reference.

Next time you open Wireshark, start with a question, apply one filter, and follow one stream. The four thousand scrolling rows are still there. They are just no longer the point.
