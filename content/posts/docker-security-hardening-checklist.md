---
title: "Docker Security Hardening Checklist: 12 Fixes That Matter"
date: 2026-08-04
description: "A practical Docker security hardening checklist: non-root users, read-only filesystems, dropped capabilities, no Docker socket, digests and limits."
tags: [Docker, Cybersecurity, DevOps]
---

A familiar story from anyone who runs security labs: a participant escapes a challenge container in under ten minutes. Not through the vulnerable web app that took a weekend to write. Through the Docker socket that was mounted "temporarily" so a helper script could restart things. The participant is usually polite about it. The person who mounted the socket usually is not, mostly at themselves.

Docker security has one underlying problem: containers are not virtual machines. They are processes on a shared kernel with some namespaces and cgroups around them, and every default that makes Docker convenient also makes it slightly too trusting. For most people that is fine. For anyone running code they did not write, or code written specifically to be attacked, the defaults are a starting point, not a finish line.

In my research area, isolated Docker-based challenges are the standard way to run security exercises, and the entire point is that people attack the containers. This Docker security hardening checklist is what I apply to every service before it goes anywhere near an untrusted user. It is not exhaustive, but it covers the mistakes that actually get exploited.

## Run containers as a non-root user

By default the process inside a container runs as root. Container root is not quite host root, but it is close enough that any escape, kernel bug or misconfigured mount becomes a full compromise instead of a nuisance.

Fix it in the image and in the runtime:

```dockerfile
RUN addgroup --system app && adduser --system --ingroup app app
USER app
```

And in Compose, `user: "10001:10001"` overrides whatever the image says. If the application "needs" root to bind port 80, it does not. Bind 8080 and publish it as 80, or grant `NET_BIND_SERVICE` alone. Needing root is almost always needing one capability and being too lazy to name it.

## Read-only root filesystem and dropped capabilities

An attacker who gets code execution in a container usually wants to drop a tool, modify a binary or write a webshell. `read_only: true` makes the root filesystem immutable, and a small `tmpfs` at `/tmp` gives the app somewhere to scribble. Most applications work fine. The ones that do not are telling you something about where they write, which you wanted to know anyway.

Capabilities are the more important half. Linux splits root's powers into around forty **capabilities** (`CAP_NET_RAW`, `CAP_SYS_ADMIN` and so on). Docker grants a default bundle that includes several a web app never uses. Drop all of them and add back the one or two you can justify:

```yaml
cap_drop: [ALL]
cap_add: [NET_BIND_SERVICE]
security_opt:
  - no-new-privileges:true
```

`no-new-privileges` stops setuid binaries inside the container from escalating, which closes a whole family of "I found an old `sudo` in the base image" tricks.

## Never --privileged, never the Docker socket

`--privileged` disables nearly every isolation feature at once. It gives the container all capabilities, access to host devices and a relaxed seccomp profile. It exists for things like running Docker inside Docker in CI. It does not exist so that a challenge container can be "easier to debug".

Mounting `/var/run/docker.sock` is worse, because it does not look dangerous. Anyone who can talk to that socket can start a new container with the host's root filesystem mounted inside it, and that is the end of the exercise. That is exactly the socket escape from the opening story. If a container genuinely needs to orchestrate other containers, put a small, authenticated API in front of the socket with a restricted allow-list of operations, and run that API somewhere the untrusted code cannot reach.

## Resource limits: the difference between a bug and an outage

Without limits, one container can take every CPU cycle, every byte of memory and every process ID on the host. A fork bomb in a challenge is not a clever attack, it is a Tuesday.

- `mem_limit` caps memory; the kernel kills the container rather than the host.
- `cpus` caps CPU share.
- `pids_limit` stops fork bombs cold. A few hundred is generous for a web app.

Combine these with a `restart` policy and the failure is contained and self-healing rather than a call from the network team. I covered restart policies and log rotation in [when you Docker Compose into chaos](/blog/when-you-docker-compose-into-chaos/), and both belong on this list too: logs that fill a disk are a denial of service you configured yourself.

## Minimal base images, scanning and pinned digests

Every package in the image is attack surface. A full Debian image ships a shell, a package manager, a pile of libraries and a handful of setuid binaries, none of which your application calls. Two alternatives:

- **Distroless** images contain your application and its runtime and almost nothing else. No shell, which frustrates attackers and, occasionally, you.
- **Alpine** images are small and do have a shell. The caveat is that Alpine uses musl instead of glibc, which occasionally breaks binaries and Python wheels in ways that cost an afternoon.

Whichever you pick, scan it. Tools such as Docker Scout, Trivy or Grype read the image layers and compare installed packages against vulnerability databases. Run the scan in CI and fail the build on critical findings, otherwise the report is just decoration.

Then pin what you deploy. A tag like `python:3.12-slim` can point to different content next week. A **digest** (`python:3.12-slim@sha256:...`) is a content hash; it cannot change underneath you. Update it deliberately, through a pull request, with the scan results attached.

## Network isolation and secrets handling

Compose's default network puts every service in a project on one flat segment. For a lab that means the challenge container can reach the scoreboard database directly, which is a shortcut participants will find.

Give each trust boundary its own network. Services join only the networks they need. Mark internal networks `internal: true` so containers on them have no route to the internet, which also stops a compromised container from downloading a second-stage toolkit.

Secrets follow the same principle of least exposure:

- Never `ENV` or `COPY` a secret into an image; it lives in the layers forever.
- Prefer Compose `secrets:`, mounted as files under `/run/secrets/`, over environment variables, which leak into `docker inspect`, crash dumps and child processes.
- Rotate anything a participant could plausibly have seen. Assume they have.

Finally, leave the default **seccomp** and **AppArmor** profiles on. Docker ships a seccomp profile that blocks a few dozen syscalls nobody legitimate uses, and on Ubuntu an AppArmor profile that restricts file access. `--security-opt seccomp=unconfined` appears in a lot of forum answers. It should not appear in your compose file.

## The Docker security hardening checklist

| # | Control | Compose / Dockerfile | Why |
|---|---|---|---|
| 1 | Non-root user | `USER app`, `user:` | Limits blast radius of any escape |
| 2 | Read-only root filesystem | `read_only: true` + `tmpfs` | Blocks persistence and webshells |
| 3 | Drop capabilities | `cap_drop: [ALL]` | Removes unneeded root powers |
| 4 | No privilege escalation | `no-new-privileges:true` | Neutralises setuid binaries |
| 5 | Never `--privileged` | Just do not | Disables isolation wholesale |
| 6 | Never mount the Docker socket | Just do not | Equivalent to host root |
| 7 | Memory, CPU, PID limits | `mem_limit`, `cpus`, `pids_limit` | Contains DoS and fork bombs |
| 8 | Minimal base image | distroless / slim | Less attack surface |
| 9 | Scan images in CI | Scout / Trivy / Grype | Catches known CVEs before deploy |
| 10 | Pin by digest | `image@sha256:...` | Reproducible, tamper-evident |
| 11 | Segmented networks | `networks:`, `internal: true` | Stops lateral movement |
| 12 | Secrets as files, defaults on | `secrets:`, default seccomp/AppArmor | Keeps credentials out of layers |

## A hardened compose service

Everything above, in one service definition you can copy:

```yaml
services:
  web-challenge:
    image: ghcr.io/example/web-challenge:1.4.2@sha256:REPLACE_WITH_REAL_DIGEST
    user: "10001:10001"
    read_only: true
    tmpfs:
      - /tmp:size=64m,noexec,nosuid
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
    mem_limit: 256m
    cpus: "0.5"
    pids_limit: 200
    networks:
      - team_net
    secrets:
      - flag
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

networks:
  team_net:
    internal: true

secrets:
  flag:
    file: ./secrets/flag.txt
```

Note there is no `cap_add`. The app listens on 8080 as an unprivileged user, so it needs nothing. If you find yourself adding `SYS_ADMIN`, stop and ask what the app is actually doing, because the answer is usually "something it should not".

## What to remember

- Container defaults are convenient, not secure. Root, a writable filesystem and a broad capability set are all opt-out.
- The Docker socket is host root with extra steps. `--privileged` is host root with fewer steps.
- Limits on memory, CPU and PIDs turn attacks into contained failures.
- Small images plus scanning plus digest pinning is how you know what you are actually running.
- Separate networks per trust boundary; secrets as mounted files, never in image layers.
- Leave seccomp and AppArmor alone. They are the cheapest defence you have.

## Further reading

- [Docker Engine security documentation](https://docs.docker.com/engine/security/) for the official view on namespaces, capabilities and the daemon attack surface.
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker) for the long-form checklist with audit commands.
- [Compose file reference](https://docs.docker.com/reference/compose-file/) for every attribute used above.

In the opening story the participant got a bonus point for the socket escape and the platform got a checklist. The platform still came out ahead.
