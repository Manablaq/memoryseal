# MemorySeal contracts

This directory contains the two canonical deployed Bradbury contracts plus historical development artifacts retained for provenance and regression reference.

## Canonical finalized deployment

Only these two source files are deployment authority for the current Bradbury release:

| Role | Source | Bradbury address | Source SHA-256 |
| --- | --- | --- | --- |
| Main | `memoryseal_claim_consensus.py` | `0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64` | `4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c` |
| Registry | `memoryseal_registry.py` | `0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B` | `ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b` |

Finalized deployment evidence is recorded in:

- [`../verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json`](../verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json)
- [`../verification/MEMORYSEAL_SPLIT_RELEASE_MANIFEST_V1.json`](../verification/MEMORYSEAL_SPLIT_RELEASE_MANIFEST_V1.json)

The finalized Main `get_registry()` observation returns the exact Registry address above.

## Contract responsibilities

### Registry

`memoryseal_registry.py` owns policy and evidence state.

Its public write surface is:

- `create_policy`
- `add_policy_issuer`
- `add_policy_origin`
- `seal_policy`
- `register_evidence`

The Registry enforces policy authority, HTTPS origins, evidence freshness/expiry, stable evidence identity, monotonic versions, and issuer/origin lineage.

### Main

`memoryseal_claim_consensus.py` owns claims and subject memory.

Its public write surface is:

- `propose_claim`
- `propose_repair_claim`
- `cancel_claim`
- `expire_claim`
- `review_claim`

The Main consumes the Registry wire views, applies policy/evidence constraints, maintains explicit claim states, bounds review liveness, and advances subject history only through supported claims.

Together these form the ten write methods exposed by the browser transaction surface.

## Historical non-canonical files

The following files are retained only as historical development/probe artifacts:

- `consensus_probe.py`
- `memoryseal.py`
- `memoryseal_bradbury_candidate.py`
- `memoryseal_candidate.py`
- `memoryseal_expiry_candidate.py`
- `memoryseal_liveness_candidate.py`
- `memoryseal_repair_candidate.py`
- `sdk_probe.py`

They are explicitly marked `NON-CANONICAL HISTORICAL DEVELOPMENT ARTIFACT` in source.

Do not use one of these files as deployment authority merely because a historical test imports it.

## Immutability rule

The current frontend/release hardening did not require a contract upgrade. The canonical Main and Registry source files therefore remain byte-identical to the finalized deployment evidence.

If either canonical file changes in a future release, the change must be treated as a new contract release: re-review compatibility, rerun the full contract verification, deploy only with explicit authorization, wait for finality, and record new append-only evidence.

See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`../docs/RELEASE.md`](../docs/RELEASE.md).
