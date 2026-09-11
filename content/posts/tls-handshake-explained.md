---
title: "TLS 1.3 Handshake Explained: What Happens Before HTTPS"
date: 2026-03-24
description: "What actually happens in a TLS 1.3 handshake: ClientHello, ECDHE key exchange, certificate chains, forward secrecy, why it beats TLS 1.2, and mistakes to avoid."
tags: [Cybersecurity, Zero Trust, DevOps]
---

The first time I saw a certificate error in a Python script, I did what every developer does. I searched the error message, found an answer with a lot of upvotes, added `verify=False`, and watched the script work. I felt efficient. I had, in fact, just told the script to trust anyone on the network who claimed to be the server, which is roughly the security posture of a puppy.

Nobody had ever explained to me what the handshake was doing, so I could not understand what I had switched off. That is the gap this post fills.

The TLS 1.3 handshake is the few milliseconds of negotiation before any HTTPS request, in which two strangers agree on a shared secret over a channel anyone can watch, and one of them proves who they are. It is elegant, it is fast, and it is worth understanding before you disable it.

## Why the TLS handshake matters to developers

TLS gives you three things: confidentiality (nobody can read the traffic), integrity (nobody can alter it undetected) and authentication (you are talking to the server you meant to). The handshake is where all three are set up. Every certificate error you have ever seen is the third property failing, and the fix is never to stop checking.

TLS 1.3, defined in RFC 8446, is the current version. It removed a great deal of legacy machinery from TLS 1.2 and is simpler to explain, which is convenient, because I am about to explain it.

## ClientHello, ServerHello and the ECDHE key exchange

The client speaks first, with a **ClientHello**. It says: here are the TLS versions I support, here are the cipher suites I am willing to use, here is the hostname I am trying to reach (the Server Name Indication, or SNI) and, crucially in 1.3, here is my half of a key exchange already. That last part is the **key_share** extension.

The key exchange is **ECDHE**: Elliptic Curve Diffie-Hellman, Ephemeral. Both sides generate a fresh random private value, derive a public value from it, and send the public value across. Each side combines its own private value with the other's public value and arrives at the same shared secret. An eavesdropper who sees both public values cannot compute the secret. That is the Diffie-Hellman trick, done on an elliptic curve such as X25519 because it is fast and the keys are small.

The server replies with a **ServerHello**: the version and cipher suite it picked, and its own key share. At this point both sides can derive the shared secret, and everything that follows in the handshake is encrypted. That is a real change from TLS 1.2, where the certificate went across in plain text.

The **ephemeral** part is what gives you **forward secrecy**. The private values are used once and thrown away. If someone records your traffic today and steals the server's long-term private key next year, they still cannot decrypt the recording, because the session key never depended on the long-term key. TLS 1.2 allowed RSA key exchange, where it did, and a stolen key unlocked the past. TLS 1.3 removed that option entirely.

## Certificates, chains and what a CA actually vouches for

Diffie-Hellman gets you a secret with *somebody*. It does not tell you who. That is the certificate's job.

The server sends its **certificate**, which binds a public key to a hostname, signed by a **Certificate Authority (CA)**. Then it sends a **CertificateVerify** message: a signature over the handshake so far, made with the private key matching that certificate. If the signature checks out, the server holds the private key, so the key share you just used really came from the entity the certificate names.

The client checks the certificate by following a **chain**: the server's leaf certificate is signed by an intermediate CA, which is signed by a root CA, and the root is one of a limited list sitting in the client's trust store. The server is supposed to send the leaf plus the intermediates. A very common production bug is sending only the leaf: browsers often paper over it by fetching the missing intermediate themselves, while `curl`, Python and your monitoring agent do not.

It is worth being precise about what a public CA vouches for. For an ordinary domain-validated certificate, the CA is asserting one thing: *at the moment of issuance, the requester demonstrated control of this domain name*. Not that the site is honest, not that the code behind it is safe, not that the organisation is who it says it is. A padlock means "you are connected to the domain in the address bar", nothing more. Phishing sites have perfectly valid certificates.

## Why TLS 1.3 is faster than TLS 1.2

TLS 1.2 needed two round trips before the first byte of application data: one to agree on parameters, another to exchange keys. TLS 1.3 sends the key share in the very first message, so the whole handshake takes one round trip. On a mobile connection with a hundred milliseconds of latency, that is a hundred milliseconds saved on every new connection.

It also cut the cipher suite list from dozens to a handful of authenticated encryption modes (AES-GCM and ChaCha20-Poly1305), removed CBC-mode ciphers, RC4, SHA-1, compression and renegotiation, and made forward secrecy mandatory. Less to negotiate, less to get wrong.

There is a 0-RTT resumption mode for repeat connections, where the client sends application data with its first message. It is fast and it is replayable, so it is only safe for idempotent requests, and most sensible deployments leave it off or restrict it.

## Watching a handshake with openssl s_client

You can see all of this from a terminal:

```bash
openssl s_client -connect example.com:443 -servername example.com -tls1_3 </dev/null
```

The output shows the certificate chain the server sent, the `Protocol` and `Cipher` lines confirming TLSv1.3, and, near the end, `Verify return code: 0 (ok)`. If that return code is anything else, you have found a real problem: a missing intermediate, an expired certificate, a hostname mismatch. Running this before touching application code has saved me from more "fixes" than I would like to admit.

## Common TLS mistakes in code and production

Here is my own mistake, so you can recognise it:

```python
import requests

# Wrong: accepts any certificate, including one presented by an attacker
r = requests.get("https://api.internal.example.com/orders", verify=False)

# Right, public CA: the default already verifies against the system trust store
r = requests.get("https://api.internal.example.com/orders")

# Right, private CA: point at your organisation's CA bundle instead of disabling checks
r = requests.get(
    "https://api.internal.example.com/orders",
    verify="/etc/ssl/certs/internal-ca.pem",
)
```

`verify=False` does not make the connection unencrypted. It makes it encrypted to whoever answered, which on a hostile network is the attacker. The other repeat offenders:

- **Self-signed certificates in production.** Fine for a lab. In production they train every client and every developer to ignore errors, which is the single worst habit you can build.
- **Expired certificates.** Expiry is not a bug; it limits the damage of a stolen key. Automate renewal with ACME and monitor expiry dates the way you monitor disk space.
- **Mixed content.** An HTTPS page loading a script over plain HTTP has handed control of the page to the network. Browsers block most of it now, but check your own pages.
- **Trusting SNI or the Host header for authorisation.** Both are attacker-controlled strings until the handshake has finished and the certificate has been checked.

## mTLS as a Zero Trust building block

Everything above authenticates the server to the client. **Mutual TLS (mTLS)** adds the reverse: the client also presents a certificate, and the server verifies it against a CA it trusts. Now both ends have a cryptographic identity, and the network they are talking over does not matter.

That is exactly the property Zero Trust wants. If you have read about [my slow slide into cybersecurity paranoia](/blog/zero-trust-zero-friends-my-journey-to-cybersecurity-paranoia/), you know the principle: never trust the network, always verify the identity. mTLS between services, with short-lived certificates issued automatically, is one of the more practical ways to make that real, and it is the workload-identity layer in much of the [Zero Trust work I do for 6G](/#research). It is also the reason service meshes exist, though that is a rant for a different day.

## What to remember

- The TLS 1.3 handshake takes one round trip: the client sends its key share in the ClientHello.
- ECDHE gives forward secrecy; a stolen server key does not unlock recorded traffic.
- A certificate proves control of a domain name at issuance, nothing about the site's honesty.
- Send the full chain. Missing intermediates work in browsers and break everywhere else.
- `verify=False` means "encrypt to whoever answers". Point at your CA bundle instead.
- mTLS gives both ends an identity, which is the foundation Zero Trust builds on.

## Further reading

- [RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446), which is more readable than most RFCs.
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/) for sane server settings without memorising cipher suite names.

If you want to see the handshake bytes rather than read about them, the [Wireshark basics post](/blog/wireshark-packet-capture-basics/) is next. Bring your own `verify=True`.
