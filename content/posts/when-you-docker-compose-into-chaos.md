---
title: "When You Docker Compose Into Chaos: 8 Pitfalls and Fixes"
date: 2026-02-24
description: "Docker Compose pitfalls that take labs down at 2am: depends_on and healthchecks, DNS by service name, volumes, .env precedence, latest tags and logs."
tags: [Docker, DevOps, Cyber Range]
---

I love Docker. Until I don't. One evening I spun up twelve containers for a student lab, one for each service and one, apparently, for my existential dread. At 2am the scoreboard stopped scoring, the database was talking to itself, and I had entered the fourth layer of YAML hell. It worked on my machine. It was no longer on my machine.

The lab in question was a Docker Compose stack: a web challenge, a database, a scoreboard and a VPN gateway. Nothing exotic. Every single thing that went wrong that night was a well-known Docker Compose pitfall that I had read about, nodded at, and then ignored because the stack "worked" for the demo.

So this post is the list I wish I had pinned above my desk. Eight Docker Compose mistakes, why each one bites, and the fix. It ends with a compose.yaml that would have let me sleep.

## depends_on does not wait for the database to be ready

This is the classic. You write `depends_on: [db]`, Compose starts the database container first, and your app immediately crashes with "connection refused". The container was running. Postgres inside it was still initialising.

`depends_on` on its own only controls **start order**, not readiness. A container counts as started the moment its process launches, which for a database is several seconds before it accepts connections. The fix is a healthcheck on the dependency, plus a condition on the dependant:

```yaml
depends_on:
  db:
    condition: service_healthy
```

Now Compose waits until the healthcheck passes before starting the app. Your app should still retry on connection failure, because databases restart at inconvenient times, but at least the first boot stops being a coin toss.

## Docker Compose networking: service names are DNS names

My scoreboard was configured to talk to `localhost:5432`. Inside a container, `localhost` is the container itself. The scoreboard was literally asking itself for a database, and I had spent forty minutes checking firewall rules.

Compose puts every service in a project onto a private network and registers each **service name as a DNS entry**. The database is reachable at `db:5432` from any other container in the same project. Not `localhost`, not the host's IP, not the container ID. The service name.

Two related traps:

- Published ports (`ports: "8080:80"`) are for traffic from **outside** the Docker network. Container-to-container traffic uses the container port (`80`) and the service name.
- If you define multiple networks, two services only see each other if they share at least one. A service on `team_net` cannot resolve a service that only sits on `admin_net`, which is a feature, until you forget it.

## Bind mounts versus named volumes

Bind mounts (`./data:/var/lib/postgresql/data`) map a host directory into the container. Named volumes (`pgdata:/var/lib/postgresql/data`) are managed by Docker. They look interchangeable in YAML and behave completely differently.

| | Bind mount | Named volume |
|---|---|---|
| Where the data lives | A path you chose on the host | Docker's storage area |
| File ownership | Host UID/GID, often wrong for the container | Initialised by the container, usually right |
| Good for | Source code during development, config files | Databases, anything the container owns |
| Failure mode | Permission errors, accidental edits, relative-path surprises | Forgetting it exists and running `docker compose down -v` |

That last one is how I lost a term's worth of scoreboard history. `down -v` removes named volumes. It says so in the help text. I read the help text afterwards.

## Environment variables and .env precedence

Compose reads a `.env` file from the project directory, but it uses it for **substituting `${VARIABLES}` inside compose.yaml**, not for automatically injecting them into containers. If you want a value inside the container, you still need `environment:` or `env_file:`.

Then there is the precedence order, which everyone gets wrong at least once. Roughly, from strongest to weakest:

1. Values in your shell or passed on the command line. These win the `${VAR}` interpolation over the `.env` file.
2. `environment:` in the compose file.
3. `env_file:` in the compose file.
4. `ENV` baked into the image.

My 2am bug: I had `DB_HOST=localhost` exported in my shell from an unrelated project. It silently overrode the `.env` file. The lesson is to run `docker compose config` before you deploy. It prints the fully resolved file, with every substitution applied, so you can see what Compose actually thinks you meant.

## Secrets in images and the latest tag

Two mistakes that do not break anything at 2am but ruin a different day entirely.

**Secrets in images.** If you `COPY .env` into an image, or bake a flag into a Dockerfile `ENV`, that value is in every layer, every registry push and every `docker history` output forever. Use Compose `secrets:`, which mounts the value as a file under `/run/secrets/`, or inject it at runtime. For a cyber range this matters doubly: students are actively looking for exactly this mistake, and they are good at it.

**The `latest` tag.** `image: postgres:latest` means "whatever the registry has when this particular host next pulls". Two lab machines built a week apart can run different major versions. Pin a specific tag (`postgres:16.4`) or, for anything that matters, a digest. I go into digests and the rest of the security side in the [Docker security hardening checklist](/blog/docker-security-hardening-checklist/).

## Restart policies and logs that fill the disk

The default restart policy is `no`. When the database container crashed at 2am because the disk was full, it stayed down, and everything that depended on it followed. `restart: unless-stopped` would have brought it back the moment there was space.

Why was the disk full? Logs. Docker's default `json-file` logging driver keeps **every line a container has ever printed**, uncapped, on the host. A chatty challenge container under a vulnerability scanner produces a remarkable volume of text. Cap it per service, or globally in `/etc/docker/daemon.json`:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

Thirty megabytes per container, rotated. You can still read recent logs with `docker compose logs`, and the disk stops being a slow-motion time bomb.

## A compose.yaml that survives the night

Here is the corrected version of the two services that caused the most grief, with every fix above applied:

```yaml
services:
  db:
    image: postgres:16.4
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 15s
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  scoreboard:
    build: ./scoreboard
    environment:
      DB_HOST: db
      DB_PORT: "5432"
      DB_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Note `start_period`: failures during that window do not count towards `retries`, so a slow first-time database initialisation does not get the container marked unhealthy before it has had a fair chance.

This is the pattern the lab stacks on [CyberRange.world](/#research) now use, and the number of 2am messages has dropped in a way I am not going to put a statistic on, because I did not measure it. I just sleep more.

## What to remember

- `depends_on` orders starts; only a healthcheck plus `condition: service_healthy` waits for readiness.
- Inside a container, `localhost` is the container. Use the service name as the hostname.
- Named volumes for data the container owns; bind mounts for code and config. `down -v` deletes named volumes.
- `.env` is for interpolating the compose file. Run `docker compose config` to see what you actually deployed.
- Never bake secrets into images. Pin image tags. Set a restart policy. Cap your logs.

## Further reading

- [Docker Compose documentation](https://docs.docker.com/compose/) for the overview and the CLI.
- [Compose file reference](https://docs.docker.com/reference/compose-file/) for every attribute mentioned here.
- [Configure logging drivers](https://docs.docker.com/engine/logging/configure/) for daemon-wide log limits.

Next time, the security side: [hardening those containers](/blog/docker-security-hardening-checklist/) so that whatever collapses at 2am is at least not the students' doing.
