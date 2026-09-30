# CLAUDE.md — `secdev-lab`

Guidance for any Claude session implementing this training lab. Read before touching code.

## What this is

`secdev-lab` is the hands-on lab for a **21h / 3-day secure-development course** (senior fullstack audience, OWASP Top 10:2025). It is a **single B2C-orders web application that is deliberately vulnerable**, plus per-module infrastructure overlays. Learners exploit, understand, fix, and prove each vulnerability.

The authoritative design is **`secdev-lab-architecture.md`** at repo root. When code and that file disagree, the file wins — or the file is stale and you flag it. Do not invent scope.

Course scope (see memory `course-scope-sept-2026`): modules **M0–M9**, 21h fixed. M4 = OIDC/NC Connect, M5 = config+crypto+secrets, M7 = Kubernetes.

## The one rule that inverts normal instincts

**This code is supposed to be vulnerable. Do not "fix" security bugs you find in `app/`.** IDOR, `sql.raw`, `jwt.decode`, MD5, `origin: true` — these are the curriculum. If a vulnerability looks accidental, check the failure→endpoint map in `secdev-lab-architecture.md` §3 before changing anything. Reference fixes live **only** in `solutions/*.patch`, never applied to `main`.

Corollary: functional tests (`app/tests/functional/`) exist so that *applying a fix patch never breaks the app*. Security tests (`app/tests/security/`) encode "fails on vulnerable code, passes after the fix". Both must stay green-on-vulnerable for functional and red-on-vulnerable for security — that inversion is intentional.

## Repository model

- **One branch: `main`. Code is vulnerable permanently.** No `mX-vulnerable`/`mX-fixed` branches (they broke in-room; see §0).
- One reference patch **per vulnerability**, not per module: `solutions/m1-idor.patch`, `solutions/m1-mass-assignment.patch`, …
- The learner's `git diff` *is* their deliverable. Keep the vulnerable baseline clean and committed so diffs read clearly.

## Learner interface — the Makefile is the only surface

Never tell a learner to type a raw `docker`/`kubectl` command. Everything goes through `make`:

| Command | Effect |
|---|---|
| `make check` | Verify Docker, Node, free ports, **free** RAM. Green/red, no ambiguity. |
| `make up M=m1` | Start that module's stack (base compose + overlay). |
| `make down` | Stop everything (and delete the k3d cluster if M7 ran). |
| `make reset` | Re-seed DB, restore code to vulnerable state. |
| `make test` | Run `tests/security` + `tests/functional`. |
| `make solution M=m1-idor` | Apply the reference patch (safety net). |
| `make hint M=m1-idor` | Print next progressive hint (3 levels). |
| `make tools` | Install pinned, checksum-verified `kubectl`/`k3d`/`trivy`/`gitleaks` into `./.bin`. Nothing global. |

`make up M=m7` is special: stops the compose stack, creates the k3d cluster, `k3d image import` (no pull), applies manifests.

## Tech stack (fixed choices)

- **App:** Express 5 · TypeScript **strict** · **Drizzle ORM** (not Prisma) · PostgreSQL · Redis.
- **Tests:** Vitest + Supertest. In-memory IdP via `jose` for M4 (tests never depend on Keycloak).
- **Infra:** Docker Compose base + per-module overlays; k3d for M7; OpenBao (dev) for M5; Keycloak for M4; Verdaccio/Gitea for M6; Loki/Grafana for M8.
- **Docs:** Docusaurus, **French**, 4-step loop per vuln (`00-brief` → `01-exploit` → `02-comprendre` → `03-corriger` → `04-prouver` → `senior.md`).

Why Drizzle: it enables the realistic injection lesson (`sql.raw` and dynamic `ORDER BY` are vulnerable even when the developer "parameterized"), the free over-fetching bug (`db.select().from(users)` leaks `passwordHash`), and it removes the Prisma engine binary from the offline bundle. See architecture §3.

## Hard constraints — do not violate

- **Offline-first.** 12 laptops start the stack at once with no reliable internet. Pin every image by tag/digest, no build-time downloads (this is a Drizzle win — no client codegen). Base stack target: **< 2 GB RAM, < 90s start**.
- **`make check` measures FREE RAM, not total.** Prereq is "16 GB strongly recommended" (M4 ≈ 2.7 GB with Keycloak, M7 ≈ 1.5–2 GB).
- **Internal Docker network only.** The single allowed external egress is the SSRF lab, whose target is an internal compose service.
- **NC Connect:** the lab never connects to real NC Connect. Keycloak realm is named **`nc-connect-sim`** (never `nc-connect`), with a "SIMULATION" banner on the login theme. Never state anything about real NC Connect that isn't in their official integration doc.
- **M6 trapped package must be genuinely harmless** — writes a witness file to `/tmp`, no working reverse shell.
- **No shared K8s cluster** (a `privileged` + `hostPath: /` pod would let one learner own everyone's node). M7 is local k3d only.
- **`senior.md` tracks exist from P0**, not added later — seniors finish M1/M2 early and must have somewhere to go.

## Build order (architecture §8) — always keep a shippable state

| Phase | Content | Plan |
|---|---|---|
| **P0** | App + seed + test harness + M1 + M2 | `docs/superpowers/plans/2026-09-29-secdev-lab-p0-foundation.md` |
| P1 | M3 + M4 (OIDC) + M5 (secrets) — contractual | *(to write)* |
| P2 | M7 (Kubernetes) + M6 (supply chain) | *(to write)* |
| P2 bis | M8 + M9 CTF (≥1 OIDC and ≥1 K8s flaw) | *(to write)* |
| P3 | Docusaurus docs, senior tracks, Kahoot quizzes | *(to write)* |
| P4 | VPS cloud-init + offline bundle + dress rehearsal | *(to write)* |

Never leave the build in a state where `make up M=m1 && make test` doesn't run. M7 is the riskiest module technically (k3d on WSL2 / Docker Desktop on Mac ARM) — don't let it slip to last.

## Conventions

- French for all learner-facing docs and hints; English for code, comments, and these engineering files.
- Test files: `app/tests/security/<mID>-<vuln>.spec.ts`. Only **one** worked example is shipped (`m1-idor.spec.ts`); learners write the rest, reference versions live in the patches.
- Patches: `git diff` output committed to `solutions/<mID>-<vuln>.patch`, applied with `git apply`.
- Every seed must be deterministic (fixed emails: `alice@example.com`, `bob@example.com`, an admin).
- Git commits end with the attribution line the harness specifies at commit time.

## Anti-patterns for this repo

- ❌ Silently hardening `app/` code. ❌ Renaming the realm away from `nc-connect-sim`. ❌ A real reverse shell in the M6 package. ❌ Build-time network downloads. ❌ Prisma. ❌ Raw docker/kubectl in learner instructions. ❌ Adding scope beyond `secdev-lab-architecture.md`.
