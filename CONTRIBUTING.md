# Contributing to MemorySeal

MemorySeal is a consequence-bearing protocol project. Contributions should preserve the distinction between historical development artifacts, canonical deployed contracts, frontend runtime code, and immutable verification evidence.

## Start from the current `main`

Before making changes:

```bash
git fetch origin
git switch main
git pull --ff-only
git status --short
```

Work on a dedicated branch. Do not develop directly on `main`.

## Release invariants

The current finalized Bradbury contract deployment is bound to:

- `contracts/memoryseal_claim_consensus.py`
- `contracts/memoryseal_registry.py`

Do not modify either canonical contract and describe the change as frontend-only maintenance.

A canonical contract change requires a separate protocol release process including:

1. source review;
2. storage/compatibility review;
3. complete regression;
4. explicit deployment authorization;
5. Bradbury deployment;
6. finality verification;
7. refreshed immutable deployment evidence; and
8. frontend/release-documentation updates.

Historical candidate/probe files may be retained for provenance, but they must remain clearly marked non-canonical.

## Frontend safety invariants

Frontend changes must preserve:

- Bradbury chain ID verification (`4221`);
- canonical Main and Registry address restrictions;
- the frozen write-method allowlist;
- finalized reads for consequential state;
- no embedded browser private keys;
- no automatic resubmission after ambiguous submission;
- transaction-recovery context binding; and
- explicit distinction between provisional and finalized transaction state.

## Python verification

Create a local virtual environment and install the frozen Python dependency set:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lock.txt
```

Run the canonical split regression:

```bash
bash verification/run_memoryseal_split_regression.sh
```

The expected suite includes:

- 1 Registry wire-model conformance test;
- 9 real Registry behavior tests; and
- 77 composed Main tests.

The local composed suite does not claim native cross-contract network routing.

## Frontend verification

Use Node.js `24.20.0` and npm `11.19.0`.

```bash
cd frontend

npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run e2e
```

Do not commit generated `.next/`, Playwright reports, test results, local Vercel metadata, environment files, or dependency directories.

## Documentation

Documentation should distinguish:

- current runtime/release status;
- immutable historical evidence;
- contract deployment identity;
- frontend deployment identity; and
- limitations of each verification layer.

Do not edit an old JSON evidence record merely to make an embedded historical `next` or status field look current. Add new documentation or new append-only evidence instead.

## Pull-request checklist

Before requesting review:

- [ ] working tree contains only intended files;
- [ ] `git diff --check` passes;
- [ ] canonical contract source hashes are unchanged unless this is explicitly a contract release;
- [ ] no secrets or wallet material are present;
- [ ] relevant Python/frontend checks pass;
- [ ] documentation matches actual behavior;
- [ ] historical artifacts remain clearly labeled;
- [ ] deployment or blockchain actions are not implied by source changes unless they actually occurred.

See [`SECURITY.md`](SECURITY.md) and [`docs/VERIFICATION.md`](docs/VERIFICATION.md).
