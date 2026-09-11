---
title: "SIEM Explained for Developers: Logs, Rules and Alert Fatigue"
date: 2026-06-30
description: "SIEM explained for developers: what a SIEM does, log sources and normalisation, structured JSON logging, a Sigma detection rule, and what never to log."
tags: [SIEM, Cybersecurity, DevOps]
---

Years ago I wrote an authentication service that, on any error, logged the full request body "for debugging". The request body on a failed login contains the password. The service was not popular, but it faithfully wrote every typo of every user's password to a log file that was shipped to a central server, indexed, and made searchable by the whole operations team.

Nobody noticed for a long time, because nobody was reading the logs. That is the second lesson. The first is that a SIEM is only as useful as what developers put into it, and nobody tells developers what that should be.

So this is SIEM explained for developers: what it is, where its data comes from, how logs become alerts, why analysts drown in them, what to log and never log, and how the same telemetry feeds live access decisions in [Zero Trust architectures](/blog/zero-trust-zero-friends-my-journey-to-cybersecurity-paranoia/).

## What a SIEM actually is

SIEM stands for Security Information and Event Management, two older ideas welded together. The "information management" half is a searchable store of every security-relevant log an organisation produces. The "event management" half is a real-time engine that correlates those logs and raises alerts when something matches a rule.

In practice a SIEM does five jobs:

1. **Collect** logs from everything: servers, applications, firewalls, identity providers, cloud APIs, endpoints.
2. **Normalise** them into a common schema so a login failure looks the same whether it came from Linux, Windows or your web app.
3. **Store** them for search and for the retention period an auditor will eventually ask about.
4. **Correlate** events across sources and time using detection rules.
5. **Alert** and hand the analyst enough context to investigate.

Splunk, Elastic Security, Microsoft Sentinel and the open-source Wazuh all differ in price and query language; the model above is the same everywhere.

## Log sources: where the data comes from

The security team will pull in network and endpoint logs without your help. What they cannot get without you is application-level meaning: a firewall knows a connection happened; only your service knows it was a login attempt, for which account, from which device, and whether it succeeded. The usual sources, least to most developer-dependent:

- **Infrastructure**: firewall, VPN, DNS, load balancer, cloud audit logs.
- **Endpoints**: operating system events, EDR agents.
- **Identity**: the identity provider's login, MFA and token events; Keycloak emits these as structured events.
- **Applications**: yours. Authentication outcomes, authorisation denials, privilege changes, sensitive data access, admin actions.

That last bullet is why developers need to care. If your service does not emit a clear "login failed for user X from IP Y" event, no rule can detect password spraying against it.

## Normalisation: why field names matter more than you think

A SIEM correlates across sources by matching fields. If your app calls the client address `ip`, the firewall calls it `src`, and the identity provider calls it `ipAddress`, then "ten failed logins from one address" is three separate questions, each with a third of the data. Normalisation maps every source into one schema. Elastic Common Schema (ECS) and the Open Cybersecurity Schema Framework (OCSF) are the common choices.

You need not adopt a whole schema, but you must be consistent: one name per concept, timestamps in UTC and ISO 8601, and an event name a rule can match exactly. `login_failed` is matchable. `"User could not be logged in :("` is a string somebody will regex for the rest of their career.

## What to log, and what never to log

Log JSON, one event per line. Text logs are for humans at a terminal; JSON logs are for machines building detections, and the machine is the one that will actually read them. A good authentication event looks like this:

```json
{
  "timestamp": "2026-06-30T09:14:07.512Z",
  "event": "login_failed",
  "service": "auth-api",
  "outcome": "failure",
  "reason": "invalid_credentials",
  "user": {"id": "u_8f3a2c", "name": "alice"},
  "src_ip": "203.0.113.42",
  "user_agent": "Mozilla/5.0 (X11; Linux x86_64)",
  "device_id": "d_41c9",
  "request_id": "3d9c0a1e-7b62-4c58-9f0e-2a7b1c8e5d44"
}
```

Every field earns its place. `event` is what rules match on. `outcome` and `reason` separate "wrong password" from "account locked" from "MFA failed". `src_ip`, `user.id` and `device_id` are what correlation groups by. `request_id` lets an analyst pull the whole trace when the alert fires. Log authorisation outcomes too: a burst of 403s from one token is often more interesting than a burst of 401s.

Now the other half. The list of things never to log is short, and every item on it has ended up in a log I have seen:

- **Secrets**: passwords, API keys, session tokens, JWTs, refresh tokens, private keys. Not even partially; not even "for debugging".
- **Full request or response bodies** on any endpoint that might contain the above, which is all of them.
- **Personal data beyond what the event needs**: full names, email addresses, dates of birth, health data. Use an internal user ID and let the analyst look it up under proper access control.
- **Card numbers and similar**: last four digits at most, preferably a tokenised reference.

Logs are copied, indexed, backed up and retained for years. A secret in a log is a secret in a dozen places you do not control, and a SIEM full of unnecessary personal data is a data protection incident waiting to happen.

## Correlation rules and a Sigma example

A detection rule is a pattern over normalised events, often with a time window and a count. Each SIEM has its own query language, which is why **Sigma** exists: a vendor-neutral YAML format that tools convert into whatever your SIEM speaks. It lives in version control and gets reviewed like code.

Sigma splits this into a base rule that matches events and a correlation rule that counts them over time. Here is "many failed logins from one address", which catches brute force against the service above:

```yaml
title: Failed Login Event
id: 6b2f3c1e-9a4d-4f0b-8c2e-1d5a7e9b3f40
name: auth_api_login_failed
status: experimental
logsource:
  product: auth-api
  service: authentication
detection:
  selection:
    event: login_failed
  condition: selection
level: informational
---
title: Multiple Failed Logins from a Single Source
id: 0c7d51a8-2e4f-4b93-a6d1-9f8e3b2c7a15
status: experimental
description: Ten or more failed logins from one source IP within five minutes
correlation:
  type: event_count
  rules:
    - auth_api_login_failed
  group-by:
    - src_ip
  timespan: 5m
  condition:
    gte: 10
level: medium
```

Two things to notice. The base rule matches exactly the `event` field from the JSON example, which is why the field name mattered. And the threshold, ten in five minutes, is a starting point, not a truth: one office NAT address might produce that every Monday morning. Tuning it against real traffic is the actual work.

## Alert fatigue: the failure mode of every SIEM

An untuned SIEM fires constantly. Analysts learn that most alerts are noise, start closing them unread, and eventually close the one that mattered. This is alert fatigue, and it is a base-rate problem: if a rule is right one time in a thousand and fires fifty times a day, nobody will be there for the one.

Developers can help more than they think:

- **Emit fewer, better events.** One `login_failed` with a `reason` beats three vague warnings.
- **Include the context an analyst needs** (user, source, device, request ID) so triage takes seconds rather than a database dig.
- **Distinguish expected failures.** A health check that returns 401 by design should be identifiable so a rule can exclude it.
- **Tune with the security team.** You know what normal looks like for your service; they know what an attack looks like.

Severity levels, suppression windows and case grouping are the analyst's tools. Clean telemetry is yours.

## How SIEM telemetry feeds Zero Trust decisions

The traditional SIEM is retrospective: something happened, a rule fired, a human investigates. Zero Trust turns the same pipeline into an input to access decisions. NIST SP 800-207 lists the SIEM among the "supporting sources" feeding the Policy Engine; in practice that is a trust score per user or device that moves with the telemetry.

The failed-login correlation above becomes more than an alert. When it fires, a small service lowers the trust score for that address or account, the policy engine sees the new score on the next request, and sensitive resources demand step-up authentication or refuse outright, with no human in the loop. When behaviour returns to normal, the score recovers. The detection did not change; the decision just happens now instead of tomorrow morning.

That only works if events are structured, normalised and fast to correlate. Your logging decisions are, quietly, access-control decisions.

## What to remember

- A SIEM collects, normalises, stores, correlates and alerts on security logs; it is only as good as the events it receives.
- Application events are the ones only developers can provide: authentication outcomes, authorisation denials, admin actions.
- Log structured JSON with consistent field names, UTC timestamps and a matchable `event` name; never log secrets or unnecessary personal data.

- Sigma gives you vendor-neutral, version-controlled detection rules; thresholds still need tuning against real traffic.
- In Zero Trust, SIEM telemetry feeds trust scores that change access decisions in real time.

## Further reading

- [Sigma detection rule format](https://sigmahq.io/) for the specification and the public rule repository.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) for what to log and what to leave out.
- [NIST SP 800-92, Guide to Computer Security Log Management](https://csrc.nist.gov/pubs/sp/800/92/final) for the long version.

The [research section](/#research) covers where these trust scores end up in 6G. And if you are wondering whether your service logs passwords, go and check. I will wait, and so will the operations team.
