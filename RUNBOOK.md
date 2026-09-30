# RUNBOOK — secdev-lab (P0)

How to run what's built today (Foundation + M1 access control + M2 injection) and how to work a lab.

## Prerequisites

- Docker running, Node ≥ 22, ports **3000 / 5432 / 6379** free.
- Check it: `make check` (green/red; measures *available* RAM, 16 GB recommended).
- One-time: `cp .env.example .env`

> On a dev box where 5432/3000 are already taken by another project, either stop that project or run the tests against a throwaway DB (see "Run tests without Docker Compose" below).

## Run the app (Docker Compose)

```bash
make up M=m1     # starts app + postgres + redis (m2 also adds mailhog)
make test        # runs the full suite inside the app container
make down        # stops everything
make reset       # re-seed DB + restore code to the vulnerable baseline
```

App: http://localhost:3000 · health: `GET /api/health`
Seeded logins (all password `Password123!`): `alice@ / bob@` (CUSTOMER), `carol@` (SELLER), `admin@example.com` (ADMIN).

## Run tests without Docker Compose (fast inner loop)

```bash
docker run -d --rm --name secdev-db \
  -e POSTGRES_USER=shop -e POSTGRES_PASSWORD=shop -e POSTGRES_DB=shop \
  -p 5433:5432 postgres:16-alpine ; sleep 5
cd app
DATABASE_URL='postgres://shop:shop@localhost:5433/shop' npx vitest run
docker stop secdev-db          # when done
```

**Expected on the vulnerable baseline:** functional tests **pass**, security tests **fail**. That inversion is correct — the security tests encode the *fixed* behavior the vulnerable code violates.

## What to do — the per-vulnerability loop

For each flaw (docs live under `docs/modules/<module>/<vuln>/` as the labs grow):

1. **Exploit** — reproduce it (e.g. Alice reads Bob's order: `GET /api/orders/2` with Alice's token → 200, leaking it).
2. **Understand** — why the code looks fine but isn't.
3. **Fix** — edit `app/src/…` yourself. Your `git diff` is your deliverable.
4. **Prove** — the matching security test in `app/tests/security/<vuln>.spec.ts` goes red→green. One worked example is provided (`m1-idor.spec.ts`); write the rest.
5. Stuck? `make hint M=m1-idor` (3 progressive hints), or `make solution M=m1-idor` applies the reference fix as a safety net.

Reset anytime with `make reset`.

## Vulnerabilities available now

- **M1 (access control):** IDOR, mass assignment, column over-fetch, role escalation, SSRF
- **M2 (injection):** SQLi (`sql.raw`), ORDER-BY identifier, prototype pollution, stored XSS, command injection

Reference fixes: `solutions/<vuln>.patch` (one per flaw). Sanity check — all patches applied should turn the whole suite green.

## Current scope & caveats

- This is **P0** only. M3–M9 (auth/session, OIDC, secrets, supply chain, Kubernetes, observability, CTF) are later plans — see `CLAUDE.md`.
- The app is **deliberately vulnerable**. Never deploy it; internal Docker network only.
- Not yet run end-to-end through Compose on a clean machine — do that "dress rehearsal" before teaching.
