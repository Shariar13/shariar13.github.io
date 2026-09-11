---
title: "Open Policy Agent Tutorial: Policy as Code with Rego"
date: 2026-05-26
description: "Open Policy Agent tutorial: what OPA is, Rego basics with default deny, a worked API authorisation policy with device posture, and testing with opa test."
tags: [Policy as Code, Zero Trust, Cybersecurity, DevOps]
---

A few years ago I inherited a system with fourteen services and, in each one, a slightly different version of `if user.role == "admin"`. Some checked `"admin"`. Some checked `"Admin"`. One checked `"admin"` or the user ID of the person who wrote it, which I assume was for debugging and which had been in production for two years.

Changing one authorisation rule meant fourteen pull requests, thirteen of which got merged. The fifteenth service, which nobody remembered existed, kept the old rule and became the door that everyone with a grudge walked through.

This is the problem policy as code exists to fix, and Open Policy Agent is the most widely used way to do it. This tutorial covers what OPA is, how it sits beside your services, enough Rego to be dangerous, a worked example combining token roles with device posture, and how to test the whole thing so the fifteenth service never happens again.

## What Open Policy Agent is

Open Policy Agent (OPA) is a general-purpose policy engine. You give it three things: a **policy** written in a language called Rego, some **data** (JSON, loaded or pushed in), and an **input** document describing the thing you want a decision about. It returns a decision, also as JSON. It does not know what an HTTP request is, or a Kubernetes pod, or a Terraform plan. It knows JSON in and JSON out, which is why the same engine gets used for all of those.

The point is decoupling. Your service stops containing authorisation logic and starts asking a question: "given this request, this user and this policy, is it allowed?" The policy lives in one place, in version control, with tests, and every service gets the same answer on the same day.

## How OPA sits beside a service

OPA is a small single binary and there are four common ways to run it:

- **Sidecar or host daemon.** OPA runs next to your service, and the service calls its REST API on localhost. The policy is local, so the round trip is sub-millisecond and there is no network dependency.
- **Envoy or Istio external authorisation.** The proxy calls OPA before forwarding a request, so your application code never sees an unauthorised request at all. This is the pattern in my [Zero Trust for 6G post](/blog/zero-trust-architecture-for-6g-networks/), where OPA is the policy decision point behind Envoy.
- **Library.** In Go you can embed OPA directly. There is also a WebAssembly build for other languages.
- **In CI.** Tools such as Conftest run OPA policies against configuration files before they ever reach a cluster.

The API call from a service looks like this:

```bash
opa run --server ./policies
curl -s localhost:8181/v1/data/httpapi/authz/allow \
  -H 'Content-Type: application/json' \
  -d @input.json
```

`input.json` is whatever your service knows about the request. OPA does not decide what goes in it; you do, and that choice is most of the design work.

## Rego basics: rules, default deny, input and data

Rego is a declarative query language, and the biggest hurdle is that it does not behave like Python. A rule is not a function you call; it is a statement that is true if all the conditions in its body hold. Five ideas cover most policies:

1. **Packages** namespace rules. `package httpapi.authz` means the rule `allow` is reachable at `data.httpapi.authz.allow`.
2. **`input`** is the document for this request. **`data`** is everything else OPA has loaded: static JSON files, bundles, pushed updates.
3. **A rule body is an AND.** Every line inside `{ }` must be true for the rule to be true.
4. **Multiple bodies are an OR.** Define `allow` twice with different bodies and it is true if either holds.
5. **Undefined is not false.** If no rule body matches, `allow` is undefined, not `false`. That is why every policy starts with `default allow := false`.

Modern Rego, written with `import rego.v1`, uses the `if` keyword for rules and `contains` for rules that build sets. Use it. The older style without these keywords still parses in many versions, but it is harder to read and will not age well.

## A worked example: role plus device posture

Here is the policy for a small reporting API. A request is allowed if the token's role is on the list for that endpoint, and the device the request came from is in an acceptable state. The role-to-endpoint mapping is data, not policy, so changing it is a JSON edit.

```rego
package httpapi.authz

import rego.v1

default allow := false

allow if {
    input.token.iss == "https://sso.example.net/realms/demo"
    input.token.role in data.permissions[input.method][input.path[0]]
    device_ok
}

device_ok if {
    input.device.managed
    input.device.os_patched
    not input.device.jailbroken
}

deny_reasons contains "unmanaged device" if not input.device.managed
deny_reasons contains "os not patched" if not input.device.os_patched
deny_reasons contains "jailbroken device" if input.device.jailbroken
```

And the data file:

```json
{
  "permissions": {
    "GET":  { "reports": ["analyst", "admin"] },
    "POST": { "reports": ["admin"] }
  }
}
```

A few things worth noticing. The issuer check is there because a token from the wrong identity provider should never get as far as a role lookup. `device_ok` is a helper rule named for the fact it establishes, so `allow` reads as English. And `deny_reasons` is a set built with `contains`: it is not used by `allow`, but your service can query it to tell the user why they were refused, instead of returning a bare 403 and an afternoon of support tickets.

Note that OPA is validating claims here, not verifying the token. Signature, expiry and audience checks belong in your gateway or your JWT library, before the claims reach OPA. The [OAuth 2.0 and OpenID Connect post](/blog/oauth2-oidc-keycloak-explained/) covers that half.

## Testing policies with opa test

Policy without tests is the fifteenth service waiting to happen. OPA has a built-in test runner: any rule whose name starts with `test_` in a file ending `_test.rego` is a test, and it passes if the rule evaluates to true.

```rego
package httpapi.authz_test

import rego.v1

import data.httpapi.authz

good_device := {"managed": true, "os_patched": true, "jailbroken": false}

test_analyst_can_read_reports if {
    authz.allow with input as {
        "method": "GET",
        "path": ["reports", "q3"],
        "token": {"iss": "https://sso.example.net/realms/demo", "role": "analyst"},
        "device": good_device,
    }
}

test_analyst_cannot_post_reports if {
    not authz.allow with input as {
        "method": "POST",
        "path": ["reports"],
        "token": {"iss": "https://sso.example.net/realms/demo", "role": "analyst"},
        "device": good_device,
    }
}

test_unpatched_device_is_denied if {
    not authz.allow with input as {
        "method": "GET",
        "path": ["reports", "q3"],
        "token": {"iss": "https://sso.example.net/realms/demo", "role": "admin"},
        "device": object.union(good_device, {"os_patched": false}),
    }
}
```

Run them with:

```bash
opa test ./policies -v
```

The `with input as` clause is the whole trick: it swaps in a fake input document for that evaluation, so tests need no HTTP server and run in milliseconds. Put the command in CI next to your unit tests and a policy regression becomes a failed build rather than a breach report. `opa fmt` and `opa check --strict` belong in the same pipeline; strict mode catches unused variables and shadowed imports that otherwise hide bugs.

## Pitfalls: readable Rego and partial evaluation

Most Rego problems are readability problems, and most readability problems come from writing it like an imperative language.

- **Do not chase early returns.** There is no `return`. Express each case as its own rule body and let OPA OR them together.
- **Name helper rules for facts.** `device_ok`, `is_admin`, `in_business_hours`. A body full of `input.x.y.z == "foo"` comparisons is unreadable in a week.
- **Keep data out of policy.** Role lists, thresholds and allowlists are data. Policy is the shape of the decision. Mixing them means every config change is a policy change, which defeats the point.
- **Beware undefined.** `not input.device.jailbroken` is true both when the field is `false` and when it is missing. Decide whether a missing field means "safe" or "unknown", and write that down. In a Zero Trust setting, unknown should mean deny.
- **Partial evaluation is a tool, not magic.** OPA can evaluate a policy with some of the input marked as unknown and hand you back the simplified conditions that remain, which is how people turn a Rego policy into a database filter. It is powerful and it is confusing, because the output is a set of residual queries rather than a decision. Do not reach for it until plain evaluation stops being enough.

## What to remember

- OPA is a JSON-in, JSON-out policy engine that decouples authorisation decisions from the services that enforce them.
- Rego rules are declarative: a body is an AND, multiple bodies are an OR, and unmatched means undefined, so always `default allow := false`.
- Use `import rego.v1` with `if` and `contains`; keep role lists and thresholds in data, not policy.
- OPA validates claims and context; token signature and expiry are checked before the claims reach it.
- `opa test` with `with input as` gives you fast, server-free policy tests, and they belong in CI.

## Further reading

- [Open Policy Agent documentation](https://www.openpolicyagent.org/docs/latest/) for the language reference, the REST API and integrations.
- [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final) for where a policy decision point fits in a Zero Trust architecture.

The [research section](/#research) has more on where this ends up in 6G networks. As for the fifteenth service, I found it eventually. It was called `legacy-api-final-v2`, which should have been a clue.
