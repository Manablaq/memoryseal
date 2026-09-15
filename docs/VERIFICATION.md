# MemorySeal verification guide

MemorySeal uses separate verification layers because a local test pass, a finalized blockchain deployment, and a production web deployment prove different things.

## 1. Canonical source identity

Current deployed contract hashes:

```text
Main
4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c

Registry
ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b
```

Verify locally on macOS/Linux:

```bash
shasum -a 256 contracts/memoryseal_claim_consensus.py
shasum -a 256 contracts/memoryseal_registry.py
```

These hashes are also bound into the finalized Bradbury evidence.

## 2. Reproducible split regression

Set up the pinned Python environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lock.txt
```

Run:

```bash
bash verification/run_memoryseal_split_regression.sh
```

Expected summary:

```text
MEMORYSEAL_SPLIT_REGRESSION=PASS
WIRE_MODEL_CONFORMANCE_TESTS=1
REAL_REGISTRY_TESTS=9
REAL_MAIN_COMPOSED_TESTS=77
DISTINCT_MIXED_SEMANTICS=53
NATIVE_CROSS_CONTRACT_ROUTING_PROVEN=NO
```

### What this proves

The suite exercises:

- strict Registry wire compatibility;
- canonical Registry policy/evidence behavior; and
- composed Main claim, review, repair, liveness, and subject-memory semantics.

### What this does not prove

The composed local harness does not claim proof of native GenLayer network cross-contract routing. The release manifest records that limitation explicitly.

Do not convert that limitation into an unstated claim.

## 3. Historical direct regression

`tests/direct/` contains regression coverage accumulated during development, including canonical and historical candidate/probe paths.

The split-release manifest records a historical reference regression of 274 tests.

Historical test coverage is useful provenance, but a candidate/probe filename does not make its contract source canonical.

## 4. Finalized Bradbury deployment evidence

Primary evidence:

[`../verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json`](../verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json)

It records:

- network: Bradbury;
- chain ID: `4221`;
- Main address;
- Main deployment transaction;
- Main finalized source hash;
- Registry address;
- Registry deployment transaction;
- Registry source hash;
- finalized Main `get_registry()` observation; and
- the exact Registry address returned by that observation.

This is a different proof layer from the local composed regression.

## 5. Release manifest

[`../verification/MEMORYSEAL_SPLIT_RELEASE_MANIFEST_V1.json`](../verification/MEMORYSEAL_SPLIT_RELEASE_MANIFEST_V1.json) records the split release and test artifact identities at the time of contract publication.

Treat it as immutable historical evidence. In particular, an embedded `next` field represents workflow state at capture time, not today's repository status.

## 6. Frontend verification

Toolchain:

- Node.js `24.20.0`
- npm `11.19.0`
- Next.js `16.3.5`
- `genlayer-js` `1.1.8`
- Playwright `1.63.0`

Run:

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

CI performs the same frontend quality gates, using a frozen dependency install and Chromium E2E.

The hardened release added/expanded coverage for:

- Bradbury wallet-chain enforcement;
- transaction journal v2;
- legacy recovery compatibility;
- context mismatch rejection;
- copyable recovery hash;
- non-resubmitting recovery;
- production security headers; and
- product/browser behavior.

## 7. Production verification

Current production alias:

`https://memoryseal-umber.vercel.app`

Basic public checks:

```bash
curl --fail --location https://memoryseal-umber.vercel.app/
curl --fail --location https://memoryseal-umber.vercel.app/app
```

Security-header inspection:

```bash
curl -sS -D - -o /dev/null https://memoryseal-umber.vercel.app/
```

The production release was independently verified with both `/` and `/app` returning HTTP `200` and the configured defense-in-depth headers present.

See [`RELEASE.md`](RELEASE.md) for the exact Vercel deployment identity.

## 8. Scheduled monitoring

`.github/workflows/production-monitor.yml` checks:

1. production `/` and `/app` are reachable and render MemorySeal; and
2. the Bradbury RPC returns chain ID `0x107d` (`4221`).

Monitoring is a liveness signal, not a replacement for release evidence.

## Verification hierarchy

For reviewer purposes, use this order:

1. exact canonical contract source hashes;
2. finalized Bradbury deployment evidence;
3. split-release regression/manifest;
4. current frontend source tree and CI;
5. current Vercel production deployment;
6. scheduled monitoring.

No single layer should be used to claim properties that belong to another layer.
