# MemorySeal

[![CI](https://github.com/Manablaq/memoryseal/actions/workflows/ci.yml/badge.svg)](https://github.com/Manablaq/memoryseal/actions/workflows/ci.yml)
[![Production monitor](https://github.com/Manablaq/memoryseal/actions/workflows/production-monitor.yml/badge.svg)](https://github.com/Manablaq/memoryseal/actions/workflows/production-monitor.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Network](https://img.shields.io/badge/GenLayer-Bradbury%204221-111827.svg)](https://explorer-bradbury.genlayer.com/)

**Consensus-gated canonical memory for autonomous agents, built on GenLayer.**

MemorySeal prevents a claim from becoming trusted merely because an agent wrote it. A claim can advance canonical subject memory only when it is bound to a sealed trust policy, versioned evidence, independent provenance requirements, freshness constraints, and a finalized protocol outcome.

> **Release status:** production verified on GenLayer Bradbury testnet. The current runtime release is anchored to commit `aef280f787187d8ccc65728ab8603aa69fdd162c`; the canonical deployed Intelligent Contract source bytes were not changed by the frontend/release hardening work.

## Live release

| Component | Identity |
| --- | --- |
| Production frontend | https://memoryseal-umber.vercel.app |
| Network | GenLayer Bradbury testnet — chain ID `4221` |
| Main contract | `0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64` |
| Registry contract | `0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B` |
| Runtime release commit | `aef280f787187d8ccc65728ab8603aa69fdd162c` |
| Runtime release tree | `f7f0bc5edb50dd9bc91597c46324b392dae9b49e` |
| Frontend tree deployed to Vercel | `e45210e8d90e587d8a1b0a32e08d2c486c633d8f` |

The production frontend reads consequential protocol state with `TransactionHashVariant.LATEST_FINAL`. A non-final transaction variant must never be presented as canonical MemorySeal state.

## Why MemorySeal exists

Shared agent memory has a consequence problem: once an unsupported statement becomes a canonical fact, downstream agents may treat it as an authorization, identity attribute, policy fact, or historical truth.

MemorySeal separates **writing a claim** from **earning canonical status**. The protocol binds each claim to explicit authority and evidence constraints before consensus can affect durable subject memory.

The trust model is intentionally stricter than “the URL and hash match”:

- policies bind approved issuers and approved HTTPS publisher origins;
- evidence uses stable record IDs with strictly increasing versions;
- evidence is checked for freshness, expiry, remaining validity, issuer lineage, origin lineage, and digest uniqueness;
- claims require policy-defined evidence counts plus distinct issuer and origin thresholds;
- evidence IDs are canonically ordered and duplicates are rejected;
- repairable evidence failures remain distinct from rejection;
- review deadlines provide a liveness boundary;
- only supported claims can advance canonical subject history.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the protocol model.

## Canonical contracts

Only two Python sources are canonical for the finalized Bradbury deployment:

| Role | Source | Source SHA-256 |
| --- | --- | --- |
| Main | [`contracts/memoryseal_claim_consensus.py`](contracts/memoryseal_claim_consensus.py) | `4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c` |
| Registry | [`contracts/memoryseal_registry.py`](contracts/memoryseal_registry.py) | `ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b` |

Finalized deployment evidence binds the Main constructor to the exact Registry address and records the deployment transaction identities:

- Main deployment tx: `0x1ad87fe39cb422ccdd8697a0dff82db60bb73ddd210a631b7f09c38097c88386`
- Registry deployment tx: `0x898aeb539d521f5f72aae2d92872ce0dad5716a70e3c64d4f79b9b0f74a0d160`
- Finalized Main evidence: [`verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json`](verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json)

Other Python contract files are retained as clearly marked historical development artifacts and are **not** deployment authority. See [`contracts/README.md`](contracts/README.md).

## Protocol flow

1. **Create a policy** — define evidence count, issuer/origin diversity, freshness, validity, claim-lifetime, and content limits.
2. **Approve issuers and origins** — policy owners bind who may attest and which HTTPS publisher origins are trusted.
3. **Seal the policy** — the policy becomes immutable and receives a fingerprint.
4. **Register evidence** — approved issuers publish versioned, digest-bound evidence under stable record identities.
5. **Propose a claim** — the Main contract binds a canonical evidence set to a subject and policy fingerprint.
6. **Review the claim** — consensus resolves the exact consequential claim state.
7. **Advance memory** — supported claims can enter subject history and become the recorded/effective subject head.

## Claim states

MemorySeal preserves consequence semantics instead of collapsing them into a single success/failure flag.

| State | Meaning |
| --- | --- |
| `REVIEWABLE` | Awaiting a review consequence |
| `SUPPORTED` | Consensus support established |
| `REJECTED` | Review concluded against the claim |
| `REPAIR_REQUIRED` | A specific evidence lineage must be repaired |
| `SUPERSEDED` | A newer supported claim replaced the prior canonical head |
| `CANCELED` | The proposer closed the claim before conclusion |
| `EXPIRED` | The review/liveness window elapsed |

## Repository structure

```text
.
├── contracts/              # Canonical deployed contracts + marked historical artifacts
├── docs/                   # Architecture, verification, and release documentation
├── frontend/               # Next.js public application
├── tests/
│   ├── direct/             # Direct/historical contract regression coverage
│   └── split_runtime/      # Canonical split Registry/Main composed regression
├── verification/           # Immutable deployment/release evidence + ABI material
├── .github/workflows/      # CI and production monitoring
├── SECURITY.md             # Security model and reporting guidance
└── CONTRIBUTING.md         # Safe contribution workflow
```

## Reproduce the canonical contract regression

The permanent split regression is intentionally separate from production chain state. It validates the real Registry behavior, strict Registry wire model, and composed Main behavior in a reproducible local harness.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lock.txt

bash verification/run_memoryseal_split_regression.sh
```

Expected terminal summary:

```text
MEMORYSEAL_SPLIT_REGRESSION=PASS
WIRE_MODEL_CONFORMANCE_TESTS=1
REAL_REGISTRY_TESTS=9
REAL_MAIN_COMPOSED_TESTS=77
DISTINCT_MIXED_SEMANTICS=53
NATIVE_CROSS_CONTRACT_ROUTING_PROVEN=NO
```

The final line is deliberate: the local composed harness does not claim proof of native network cross-contract routing. Finalized Bradbury deployment evidence is a separate evidence layer.

See [`docs/VERIFICATION.md`](docs/VERIFICATION.md) and [`tests/README.md`](tests/README.md).

## Frontend development

The frontend is pinned to Node.js `24.20.0`, npm `11.19.0`, Next.js `16.3.5`, `genlayer-js` `1.1.8`, and Playwright `1.63.0`.

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

The browser transaction surface is restricted to the ten frozen MemorySeal write methods and the canonical Main/Registry addresses. Wallet sessions must be on Bradbury chain ID `4221`.

Transaction recovery is deliberately non-resubmitting: journal v2 binds the transaction hash to chain, wallet, contract, method, and timestamp context, and recovery tracking never automatically submits the underlying write again.

See [`frontend/README.md`](frontend/README.md).

## Verification and release evidence

MemorySeal separates three proof layers:

- **source and regression evidence** — exact source identities and reproducible contract/frontend tests;
- **finalized deployment evidence** — finalized Bradbury addresses, deployment transactions, source hashes, and Main → Registry constructor binding;
- **production frontend evidence** — the verified frontend tree deployed to the existing MemorySeal Vercel project.

Current release identities and boundaries are documented in [`docs/RELEASE.md`](docs/RELEASE.md).

Files under `verification/` are historical evidence records captured at specific workflow stages. Their embedded status/`next` fields describe the moment of capture and must not be rewritten to represent later stages. See [`verification/README.md`](verification/README.md).

## Security

The principal security boundaries are:

- finalized canonical reads;
- policy-bound evidence authority;
- immutable/versioned evidence identities;
- explicit freshness and expiry checks;
- distinct issuer and origin corroboration;
- bounded claim liveness;
- canonical-address and write-method restrictions;
- provider-backed browser wallet writes with no embedded private keys;
- no automatic transaction resubmission after ambiguity;
- context-bound transaction recovery;
- immutable finalized contract-source evidence;
- CSP, HSTS, clickjacking, MIME-sniffing, referrer, and permissions-policy response hardening.

See [`SECURITY.md`](SECURITY.md).

## Operations

A scheduled GitHub Actions monitor checks:

- the public `/` and `/app` routes; and
- that the configured Bradbury RPC still reports chain ID `4221`.

The release hardening did **not** redeploy or mutate the canonical contracts because their source semantics did not require a change. Their finalized source hashes remained byte-identical throughout the release.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — protocol components, trust boundaries, state model, and data flow
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — reproducible verification and what each evidence layer proves
- [`docs/RELEASE.md`](docs/RELEASE.md) — exact production release identities and deployment boundaries
- [`contracts/README.md`](contracts/README.md) — canonical vs historical contract sources
- [`tests/README.md`](tests/README.md) — test-suite authority and reproducibility
- [`verification/README.md`](verification/README.md) — evidence-artifact index and immutability rules
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — safe contribution workflow
- [`SECURITY.md`](SECURITY.md) — security model and reporting guidance

## License

MemorySeal is licensed under the Apache License, Version 2.0 (`Apache-2.0`). See [`LICENSE`](LICENSE).
