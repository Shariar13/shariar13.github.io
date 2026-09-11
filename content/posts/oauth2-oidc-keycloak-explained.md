---
title: "OAuth 2.0 vs OpenID Connect Explained (with Keycloak)"
date: 2026-04-21
description: "OAuth 2.0 vs OpenID Connect without tears: access, ID and refresh tokens, authorisation code flow with PKCE, JWT validation in Python, and Keycloak."
tags: [Identity, Cybersecurity, Zero Trust]
---

The first time I wired a "Login with" button into an API, I took the shiny token that came back, put it in an `Authorization` header, and sent it to my backend. It worked. It kept working for months. Then someone asked which token I was using and I said "the one with the user's name in it", and watched their face do something complicated.

I had been using the ID token as an access token. It worked because my backend checked the signature and nothing else, so any token the identity provider signed for any application would have opened the door. It was not a security flaw so much as a security suggestion.

So here is OAuth 2.0 vs OpenID Connect explained without tears: which protocol does what, which token is for whom, why the authorisation code flow with PKCE is the only one you should use, how to validate a JWT properly, and how it all maps onto Keycloak.

## Authorisation vs authentication: what OAuth 2.0 is not

**OAuth 2.0** (RFC 6749) is a delegated authorisation framework. It solves one problem: letting an application access a resource on a user's behalf without the user handing over their password. The output is an access token that says "this client may do these things at that API". Notice what it does not say: who the user is. OAuth 2.0 has no concept of identity, only of permission.

**OpenID Connect (OIDC)** is an identity layer built on top of OAuth 2.0. It adds an ID token that asserts who authenticated, when, and how, plus a standard set of claims (subject, name, email) and a userinfo endpoint. If OAuth 2.0 is a hotel key card, OIDC is the passport you showed at reception. The card opens doors; the passport says who you are. They are handed over in the same transaction, which is why people confuse them.

Authentication is proving who you are; authorisation is being allowed to do something. OAuth 2.0 is the second, and using it alone for the first is how "Login with" buttons went wrong for years.

## Access token vs ID token vs refresh token

| Token | Issued by | Meant for | Says | Typical lifetime |
|---|---|---|---|---|
| Access token | OAuth 2.0 / OIDC | The API (resource server) | "Bearer may do X at API Y" | Minutes |
| ID token | OIDC only | The client application | "User Z authenticated at time T" | Minutes |
| Refresh token | OAuth 2.0 / OIDC | The authorisation server | "Client may request new tokens" | Hours to days |

The rule that resolves most confusion: **look at the audience**. The ID token's `aud` is the client ID, because it is a message to the application; the access token's `aud` is the API. Sending an ID token to an API is delivering someone else's post, and an API that accepts it is not reading the envelope.

Refresh tokens are never sent to an API, only back to the authorisation server for a fresh pair. Store them carefully, rotate them on use, and make them revocable: they are the long-lived credential in the system.

## The authorisation code flow with PKCE

For anything with a user and a browser there is now one flow: authorisation code with **PKCE** (Proof Key for Code Exchange, RFC 7636). It goes like this:

1. The client generates a random `code_verifier` and derives a `code_challenge` from it (a SHA-256 hash, base64url-encoded).
2. The client redirects the browser to the authorisation server with its client ID, redirect URI, requested scopes, a `state` value, and the `code_challenge`.
3. The user authenticates (password, MFA, passkey) and consents.
4. The server redirects back to the client's redirect URI with a short-lived, single-use **authorisation code** and the `state`.
5. The client checks `state`, then sends the code plus the original `code_verifier` to the token endpoint, over a back channel.
6. The server hashes the verifier, compares it to the challenge from step 2, and only then issues the access, ID and refresh tokens.

PKCE exists because the code travels through the browser and can be intercepted; without the verifier, an intercepted code is worthless. It was designed for mobile apps that cannot keep a secret, and current guidance now recommends it for all clients, confidential ones included.

## Why the implicit flow is dead

The implicit flow returned the access token directly in the redirect URL fragment, skipping the code exchange. It was a shortcut for single-page apps before browsers did cross-origin requests properly, and it is a list of things you do not want:

- Tokens in URLs end up in browser history, referrer headers, proxy logs and screenshots.
- There is no client authentication and no proof of possession, so a leaked token is fully usable.
- No refresh token, so people compensated with long-lived access tokens, which is worse.

The OAuth 2.0 Security Best Current Practice recommends against it, and the OAuth 2.1 draft removes it entirely. If a tutorial tells you to use `response_type=token`, close the tab.

## Validating a JWT: issuer, audience, expiry, signature via JWKS

ID tokens, and usually access tokens, are JWTs (JSON Web Tokens): signed JSON you can verify offline. Your API does not call the identity provider on every request; it fetches the provider's public keys from its JWKS (JSON Web Key Set) endpoint, caches them, and checks signatures locally.

Four checks are non-negotiable: the **signature** is valid under a JWKS key, the **issuer** (`iss`) is the provider you expect, the **audience** (`aud`) includes your API, and the token has not **expired** (`exp`). In Python with PyJWT, which handles key fetching and caching:

```python
import jwt
from jwt import PyJWKClient

ISSUER = "https://sso.example.net/realms/demo"
AUDIENCE = "reports-api"

jwks = PyJWKClient(f"{ISSUER}/protocol/openid-connect/certs")

def validate(token: str) -> dict:
    signing_key = jwks.get_signing_key_from_jwt(token).key
    return jwt.decode(
        token,
        signing_key,
        algorithms=["RS256"],
        issuer=ISSUER,
        audience=AUDIENCE,
        options={"require": ["exp", "iss", "aud", "sub"]},
    )
```

The `algorithms` list is not decoration: pinning it stops the classic attack where a token declares `"alg": "none"` or swaps an asymmetric key for a symmetric one. `require` makes missing claims a failure rather than a silent pass. What the function returns can be trusted as claims, which is where a policy engine like [Open Policy Agent](/blog/open-policy-agent-rego-tutorial/) takes over the "is this allowed" question.

## Common mistakes I have made or watched

- **Using the ID token as an access token.** See the opening of this post. The ID token is addressed to the client; an API that accepts it trusts the wrong audience.
- **Not validating `aud`.** Any token from the provider then works at any API, so one compromised low-value service becomes a skeleton key.
- **Decoding without verifying.** Every JWT library has a "decode, skip signature" option for debugging. It has a way of ending up in production.
- **Long-lived access tokens.** A token that lives for a day cannot be meaningfully revoked. Keep them to minutes and let revocable refresh tokens do the long-lived work.
- **Storing tokens in `localStorage`.** Any script on the page can read it, including the analytics tag you forgot about. A backend-for-frontend holding tokens server-side is the boring, correct answer.

## Keycloak realms, clients and roles in practice

Keycloak is an open-source identity provider that speaks OIDC and OAuth 2.0. Its vocabulary maps onto the concepts above like this:

- A **realm** is an isolated tenant: its own users, clients, keys and login pages. The issuer URL contains the realm name, so `iss` validation also confirms you are talking to the right tenant.
- A **client** is an application registered in the realm. **Public** clients (browser, mobile) have no secret and must use PKCE. **Confidential** clients (backend services) have a secret or certificate and can use the client credentials grant for machine-to-machine calls.
- **Roles** exist at realm level or per client and end up as claims in the token. I lean towards keeping roles coarse in the token and fine-grained decisions in a policy engine.
- **Client scopes and mappers** control which claims go into which token. The one that bites everyone: by default Keycloak does not put your API's client ID in the access token's `aud`; you add an audience mapper. If your `aud` check fails on a fresh realm, the fix is a mapper, not disabling the check.

All of this is the foundation of Zero Trust, where every enforcement point trusts the identity provider and every other decision sits on a verified token. The [Zero Trust for 6G post](/blog/zero-trust-architecture-for-6g-networks/) shows Keycloak in exactly that role.

## What to remember

- OAuth 2.0 is authorisation (what a client may do); OpenID Connect adds authentication (who the user is).
- Access tokens are for APIs, ID tokens are for the client, refresh tokens are for the authorisation server only. Check `aud`.
- Use the authorisation code flow with PKCE for everything with a browser; the implicit flow is dead.
- Validate signature via JWKS, issuer, audience and expiry, with the algorithm pinned.
- In Keycloak, a realm is a tenant, a client is an app, and you must add an audience mapper before your `aud` check will pass.

## Further reading

- [RFC 6749, The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749).
- [RFC 7636, Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636).
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html).
- [Keycloak documentation](https://www.keycloak.org/documentation).

The [research section](/#research) covers the 6G trust plane all this token-checking feeds. And if your API accepts a token because it has the user's name in it, I have been there, and the face was warranted.
