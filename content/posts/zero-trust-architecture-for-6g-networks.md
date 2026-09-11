---
title: "Zero Trust Architecture for 6G Networks: Building a Trust Plane"
date: 2026-07-14
description: "Why 6G networks need Zero Trust, and how to build a trust plane from open components: Keycloak, Envoy, Open Policy Agent and telemetry-driven trust scores."
tags: [Zero Trust, 6G, Cybersecurity, Research]
---

5G was sold as "a network for everything". 6G is being sold as "a network for everything, except now the everything has opinions". Sensors, vehicles, drones, factory robots, medical wearables, and a layer of AI that reconfigures the network on its own, all sharing infrastructure owned by several operators and built by several vendors.

Imagine an office building where every desk, chair and light bulb has a network interface, the tenants change hourly, the walls are software, and the building manager is a machine learning model. Now secure it with a firewall at the front door.

You cannot. Which is why Zero Trust Architecture for 6G networks is not a buzzword-pairing exercise; it is the only model that survives contact with the design. I work on this as part of the Horizon Europe XTRUST-6G project, and this post is the general shape of the problem plus one workable way to build the trust plane from open components. It does not describe project results, because those go through peer review, not a blog.

## Why 6G networks need Zero Trust

If you have read the [Zero Trust primer](/blog/zero-trust-zero-friends-my-journey-to-cybersecurity-paranoia/), you know the perimeter model fails when the inside stops being inside. 6G takes every reason it fails and multiplies it.

- **Massive device counts.** Design targets assume device densities well beyond anything today, and most of those devices will be cheap, rarely patched, and physically reachable by anyone with a ladder. "A device on the network" is meaningless when the network includes a parking sensor.
- **Network slicing.** One physical network carved into virtual slices: one for emergency services, one for a car manufacturer, one for consumer broadband. Slices share radio, compute and transport, so the isolation between them is a policy, not a cable. Policies need enforcing.
- **Multi-tenant, multi-vendor.** The radio unit is from one vendor, the core from another, the orchestration from a third, and three operators share the site. There is no single organisation whose "inside" you could trust even if you wanted to.
- **Edge computing.** Workloads run at the base station because latency demands it. That means application code, possibly from a third party, executing on infrastructure that used to only forward packets. Edge nodes are also physically scattered, which means physically attackable.
- **AI-native networks.** 6G designs assume closed-loop automation: models that watch telemetry and reconfigure slices, routing and resources. An agent with the power to reshape the network is a very attractive thing to feed poisoned inputs. Its actions need authorising like anyone else's.

Every one of those points argues for the same thing: decide access per request, on verified identity and current context, at an enforcement point next to the resource. That is Zero Trust, and it has to be built into the network functions rather than bolted on at the front.

## The trust plane: Zero Trust as a network function

Architecturally the NIST SP 800-207 split holds: a control plane that decides (Policy Engine plus Policy Administrator) and a data plane that enforces (Policy Enforcement Points). In a telecoms setting I call the deciding half the **trust plane**, sitting alongside the control and user planes network engineers already know.

Here is the shape of one, built from components you can download this afternoon:

```text
            +----------------------------------------------------+
            |                    TRUST PLANE                     |
            |  +-----------+    +-----------+    +-----------+   |
            |  | Keycloak  |    |    OPA    |<---|   Trust   |   |
            |  | identity  |    |  policy   |    |   score   |   |
            |  |  (OIDC)   |    | decision  |    |  service  |   |
            |  +-----+-----+    +-----+-----+    +-----^-----+   |
            +--------|----------------|----------------|---------+
                     | tokens         | allow / deny   | telemetry
                     v                v                |
 subject  ---->  +---------------------------+  ---->  network function
 (device, NF,    |   Envoy  (PEP / proxy)    |         (slice API, edge app,
  AI agent)      |   jwt_authn + ext_authz   |          orchestrator)
                 +-------------+-------------+
                               |
                               +--> access logs --> SIEM / telemetry --> trust score
```

The flow, in prose:

1. A subject (a device, a network function, an AI agent) obtains a short-lived token from **Keycloak** over OpenID Connect. Workloads use client credentials or certificate-bound identities; humans get MFA.
2. Every request to a protected function passes through **Envoy**, the PEP. Envoy decides nothing: it validates the token's signature, issuer and audience, then asks an external authoriser.
3. That authoriser is **Open Policy Agent**, which evaluates Rego policy over the token claims, the request, and extra data including the subject's current trust score.
4. Envoy's access logs, Keycloak's events and the network functions' own logs flow into a **SIEM-style telemetry pipeline**, which computes a per-subject **trust score** and pushes it back into OPA as data.

Nothing in that chain is exotic, and none of it is a product called "Zero Trust".

## Envoy as the Policy Enforcement Point

Envoy's external authorisation filter is what makes the proxy defer decisions instead of making them. A minimal filter chain looks like this:

```yaml
http_filters:
  - name: envoy.filters.http.jwt_authn
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.jwt_authn.v3.JwtAuthentication
      providers:
        keycloak:
          issuer: https://sso.example.net/realms/6g
          audiences: [slice-api]
          remote_jwks:
            http_uri:
              uri: https://sso.example.net/realms/6g/protocol/openid-connect/certs
              cluster: keycloak
              timeout: 2s
          payload_in_metadata: jwt_payload
      rules:
        - match: { prefix: "/" }
          requires: { provider_name: keycloak }
  - name: envoy.filters.http.ext_authz
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.ext_authz.v3.ExtAuthz
      grpc_service:
        envoy_grpc: { cluster_name: opa }
      failure_mode_allow: false
  - name: envoy.filters.http.router
    typed_config:
      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
```

Two lines matter most. `failure_mode_allow: false` means that if OPA is unreachable the answer is deny; a PEP that fails open is a firewall with a hole labelled "maintenance". And the JWT filter checks issuer, audience and signature before OPA sees the request, so policy is evaluated over claims you can trust.

## Open Policy Agent as the decision point

OPA holds the policy in Rego and answers allow or deny in a few milliseconds from a sidecar next to Envoy. The interesting design choice is what it evaluates over: not just the token, but slice membership and the live trust score.

```rego
package envoy.authz

import rego.v1

default allow := false

allow if {
    claims := input.attributes.metadata_context.filter_metadata["envoy.filters.http.jwt_authn"].jwt_payload
    slice := input.attributes.request.http.headers["x-slice-id"]
    slice in claims.slices
    data.trust[claims.sub].score >= data.thresholds[slice]
}
```

Read it as four conditions joined by AND: pull the verified claims Envoy stashed in metadata, read the requested slice, check the subject is entitled to it, and check its trust score clears that slice's threshold. Emergency services get a higher threshold than consumer broadband, and changing it is a data edit, not a redeploy. I go through Rego properly in the [Open Policy Agent tutorial](/blog/open-policy-agent-rego-tutorial/).

## Continuous trust evaluation vs one-time authentication

The classic mobile model authenticates the device when it attaches, then trusts the session. That is one-time authentication, exactly the failure mode Zero Trust exists to remove. In the build above, continuous evaluation comes from three mechanisms.

- **Short-lived tokens.** Keycloak issues access tokens that live for minutes. Re-issuing one is cheap, and a revoked subject stops working quickly without a global revocation list.
- **Live data in the policy engine.** The trust score is not baked into the token. It is data OPA holds and refreshes continuously, through bundles or a push API. The same token can be allowed at 10:00 and denied at 10:02 if the score has dropped.
- **Telemetry that moves the score.** The pipeline watches for the usual signals: repeated authentication failures, traffic that does not match the device's declared type, stale posture attestations, a device appearing in two cells at once. An ML-based intrusion detector can contribute too, as one input among several, not the judge.

Where is NIST's Policy Administrator? Partly it is the token lifetime, since expiry is the simplest way to tear down access. Partly it is a small controller that pushes fresh scores to OPA and, when one collapses, asks Keycloak to end the subject's sessions. NIST's diagram has neat boxes; real deployments spread the job around.

## What is still genuinely hard

I would be lying if I said this was solved. The open problems, as I see them:

- **Latency.** A policy round-trip that is fine for a web API is not fine at radio timescales. Fast-path decisions must be local; the score is computed asynchronously and only looked up synchronously.
- **Identity for cheap devices.** A sensor that costs less than a coffee does not do public-key cryptography cheerfully. The long tail of devices needs something lighter and just as verifiable.
- **Trust across domains.** Operator A's trust score means nothing to operator B without a shared vocabulary and a reason to believe each other's telemetry.
- **AI agents as subjects.** An orchestration model needs an identity, scoped permissions and an audit trail like any other subject.

## What to remember

- 6G's device counts, slicing, multi-vendor edge and AI-driven automation make a perimeter impossible; Zero Trust is the only model that fits.
- The trust plane is NIST's control plane by another name: identity provider, policy engine and score service deciding; proxies enforcing.
- Keycloak, Envoy and OPA together give you identity, enforcement and decision without buying a "Zero Trust" product.
- Continuous evaluation comes from short-lived tokens plus live data in the policy engine, not from re-authenticating everything.
- Telemetry is a policy input, so the SIEM pipeline is part of the architecture, not an afterthought.

## Further reading

- [NIST SP 800-207, Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) for the reference model.
- [Envoy external authorisation filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/ext_authz_filter) for the PEP plumbing.
- [Open Policy Agent documentation](https://www.openpolicyagent.org/docs/latest/) for Rego and the Envoy integration.

If you want to know more about the research side, the [research section](/#research) has the short version. And if your light bulbs ever start negotiating slice access, you will know why I stopped sleeping.
