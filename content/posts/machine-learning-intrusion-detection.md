---
title: "Machine Learning for Intrusion Detection: What Actually Works"
date: 2026-07-28
description: "How machine learning intrusion detection works: flow features, random and isolation forests, dataset pitfalls, class imbalance, drift and SIEM deployment."
tags: [Machine Learning, Cybersecurity, SIEM]
---

Picture a first anomaly detector for network traffic that has one confirmed detection in its first month. It caught the nightly backup job. Every night. At 02:00, several gigabytes left the file server for the storage array, and every night the model raised the alarm like a dog that has just discovered the postman exists.

Meanwhile a student in a lab was port-scanning half the subnet for a coursework exercise, and the model said nothing, because port scans had been in the training data and the training data was labelled "normal".

That is machine learning intrusion detection in miniature: a model that learns exactly what you show it, a network that never stops changing, and an analyst who stops reading the alerts after week two. This post is about what actually works, which is a shorter list than the papers suggest. If you want the background on where these alerts end up, read [SIEM explained for developers](/blog/siem-explained-for-developers/) first.

## Signature versus anomaly detection: two ways to be wrong

A **signature-based** intrusion detection system (IDS) matches traffic against known-bad patterns: a byte sequence in an exploit, a domain on a blocklist, a rule that says "SMB traffic from the printer VLAN is not a thing". Snort and Suricata are the well-known examples. Signatures have near-zero false positives on what they cover, and they cover nothing they have not seen before.

**Anomaly-based** detection flips it. Learn what normal looks like, and flag anything sufficiently far from it. It can in principle catch novel attacks. It will also catch the backup job, the new monitoring agent, the intern who discovered `wget -r`, and the first day of term.

Neither replaces the other. Signatures give you precision on known threats; models give you coverage with a false-positive bill attached.

## Feature engineering from network flows

Nobody feeds raw packets into a production model; the volume is absurd and the payload is mostly encrypted. Instead you aggregate packets into **flows**: everything between one source IP and port and one destination IP and port, over one protocol, within a time window. That is what NetFlow, IPFIX and Zeek produce.

A flow record gives you features like:

- Duration, total packets and bytes in each direction
- Mean, standard deviation, minimum and maximum packet size
- Inter-arrival time statistics
- TCP flag counts (SYN without ACK is a scan; RST storms are something else)
- Destination port and protocol

Then you build the features that actually catch things, usually **per-host aggregates over a window**: distinct destination ports touched in the last minute, distinct destinations, failed connections. One flow from a port scan looks like any other tiny TCP flow; five hundred of them to five hundred ports in ten seconds is the signal.

Two features to be suspicious of: IP addresses, because a model that learns "attacks come from 192.168.10.5" has learned your lab layout, not attacks; and absolute timestamps, because in public datasets the attacks ran on specific days and a model will happily learn the calendar.

## Random forests, isolation forests and deep models

For tabular flow features, tree ensembles are the boring, correct default.

A **random forest** is supervised: you need labelled benign and attack flows, and it learns to separate them. It copes with junk features, trains in minutes, and gives you feature importances you can show an analyst.

An **isolation forest** is unsupervised: it builds random trees and scores each point by how few splits it takes to isolate it. Anomalies are easy to isolate, so they get short paths. You train it on traffic you believe is mostly benign and it hands you a score with no notion of what an attack is.

Here is the skeleton:

```python
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split

flows = pd.read_parquet("flows.parquet")
features = ["duration", "fwd_bytes", "bwd_bytes", "fwd_pkts", "bwd_pkts",
            "mean_pkt_len", "syn_count", "dst_port", "uniq_dst_ports_60s"]
X, y = flows[features], flows["label"]  # label: 0 benign, 1 attack

# Unsupervised: fit on benign only, score everything
iso = IsolationForest(contamination=0.01, random_state=0)
iso.fit(X[y == 0])
anomaly_score = -iso.score_samples(X)  # higher = more anomalous

# Supervised: needs labels, gives you feature importances
X_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, random_state=0)
rf = RandomForestClassifier(n_estimators=300, class_weight="balanced", n_jobs=-1)
rf.fit(X_tr, y_tr)
print(sorted(zip(rf.feature_importances_, features), reverse=True)[:5])
```

The `train_test_split` there is the naive version; see the evaluation section for why.

Deep models, such as autoencoders on flow features or sequence models over packet timings, get the papers. On tabular data they rarely beat a tuned tree ensemble by much, they cost more to train and serve, and when they fire nobody can say why. Where they earn their keep is on data with real structure, such as payload bytes or long sequences of events. If you want the general lesson on why models learn the wrong thing, I have [a neural network that fears cats](/blog/how-i-taught-my-neural-network-to-fear-cats/) to show you.

## Public datasets: CIC-IDS2017, UNSW-NB15 and their problems

Almost every paper evaluates on one of two datasets.

**CIC-IDS2017** was generated by the Canadian Institute for Cybersecurity over a working week: scripted benign traffic plus a schedule of attacks such as brute force, DoS and web attacks. **UNSW-NB15** came from UNSW Canberra, using a commercial traffic generator to mix normal traffic with several attack families.

Both are useful. Both have well-documented problems that you should know before you cite a 99.9% number:

- The traffic is synthetic or scripted. Real networks have more variety in the benign class than any generator produces.
- Later researchers found labelling errors and flow-extraction bugs in CIC-IDS2017 and released corrected versions.
- Attacks run on fixed days from fixed hosts, so IPs and timestamps leak the label.
- The attack families are from the mid-2010s. Nothing in them looks like today's encrypted command-and-control traffic.

A model that scores near-perfectly on a public dataset has demonstrated that it can learn a lab, not that it can protect a network.

## Class imbalance, concept drift and false positives at scale

Three problems that matter more than the choice of model.

**Imbalance.** On a real network, well over 99% of flows are benign. A classifier that says "benign" to everything gets over 99% accuracy and catches nothing. Class weights, resampling and threshold tuning help; reporting accuracy at all does not.

**Concept drift.** Normal changes. A new SaaS tool is rolled out, term starts. An anomaly model trained in August is confused by October. You need a retraining schedule and monitoring of the score distribution itself, because the first sign of drift is usually the alert volume quietly doubling.

**False positives at scale.** This is the one that kills deployments. Say your model has a false positive rate of 0.1%, which sounds excellent. On a network producing ten million flows a day, that is ten thousand false alerts a day. No analyst team on earth reads that. The alerts get routed to a folder, the folder is ignored, and the one true positive lands in the same folder.

The number that matters is not the false positive rate. It is **alerts per analyst per day at the detection rate you need**.

## Evaluation beyond accuracy

If you take one thing from this post, take this:

1. **Report precision, recall and F1 per attack class**, not one overall accuracy.
2. **Use precision-recall curves**, not ROC, when the positive class is rare. ROC curves look flattering on imbalanced data.
3. **Fix an alert budget** and report recall at that budget: "at 50 alerts a day, we catch this fraction of attacks".
4. **Split by time, not at random.** Train on week one, test on week two. Random splits put the same attack session on both sides and inflate everything.
5. **Test on a different network** if you possibly can. Generalisation across networks is the real question.

## Deploying alongside a SIEM

The model is not the IDS. It is one signal feeding the thing that already collects the logs. The sensible architecture is:

- Flows are exported from the network to a collector.
- The model scores each flow or host-window aggregate and emits an event with the score, top contributing features and flow identifiers.
- That event enters the SIEM like any other log source and is correlated with authentication logs, endpoint alerts and the signature IDS.
- Analysts triage in the SIEM, and their verdicts flow back as labels for the next retraining round.

Correlation is what makes the false positives survivable. "Anomalous outbound flow" on its own is noise. "Anomalous outbound flow from a host that also had a failed admin login and a new scheduled task" is an incident. Sending the model's opinion to the SIEM with its reasons attached lets a rule do that join. This is the part I care most about in my own [research](/#research): detection is cheap, triage is not.

## What to remember

- Signatures give precision on known attacks; anomaly models give coverage with a false-positive bill. You want both.
- Engineer features from flows and per-host windows. Never let the model see IP addresses or absolute timestamps.
- Tree ensembles are the right default on flow features. Deep models need a reason.
- Public datasets are labs. High scores on them prove very little about real networks.
- Evaluate with per-class precision and recall, time-based splits and a fixed alert budget.
- The model is a log source for the SIEM, not a replacement for it.

## Further reading

- [scikit-learn IsolationForest](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html) and [RandomForestClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html) documentation.
- [NIST SP 800-94, Guide to Intrusion Detection and Prevention Systems](https://csrc.nist.gov/pubs/sp/800/94/final).
- [CIC-IDS2017](https://www.unb.ca/cic/datasets/ids-2017.html) and [UNSW-NB15](https://research.unsw.edu.au/projects/unsw-nb15-dataset) official pages.

The backup job, incidentally, is still flagged every night. I have come to think of it as a heartbeat.
