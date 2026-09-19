# MemorySeal verification artifacts

This directory contains immutable or reproducible evidence used to establish the identity and behavior of the current MemorySeal Bradbury release.

## Evidence index

### `MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json`

Records finalized deployment evidence for the current split release, including:

- Main address and deployment transaction;
- Registry address and deployment transaction;
- source SHA-256 identities;
- Bradbury network identity;
- finalized status observations; and
- finalized Main → Registry constructor binding through `get_registry()`.

This is the primary machine-readable deployment/finality evidence record.

### `MEMORYSEAL_SPLIT_RELEASE_MANIFEST_V1.json`

Records the split-release test and source manifest captured during the contract-release workflow, including:

- canonical source identities;
- constructor compatibility regression;
- historical reference regression;
- permanent composed-suite counts and artifact hashes;
- deployment identities; and
- explicit verification limitations.

This file is a historical capture. Fields such as `next` describe what the workflow intended **at the time the manifest was written**. They are not the source of truth for the repository's current release status.

### `run_memoryseal_split_regression.sh`

Runs the reproducible permanent split regression:

```bash
bash verification/run_memoryseal_split_regression.sh
```

Expected result:

```text
MEMORYSEAL_SPLIT_REGRESSION=PASS
WIRE_MODEL_CONFORMANCE_TESTS=1
REAL_REGISTRY_TESTS=9
REAL_MAIN_COMPOSED_TESTS=77
DISTINCT_MIXED_SEMANTICS=53
NATIVE_CROSS_CONTRACT_ROUTING_PROVEN=NO
```

### `abi/`

Contains ABI material captured for verification/integration use.

### `sdk/`

Contains SDK-related verification material retained from the release workflow.

## Evidence immutability

Do not rewrite historical JSON evidence merely to make an old status or `next` field reflect a newer repository state.

When a later stage establishes new facts, use one of the following:

- append a new evidence artifact;
- add/update human-readable release documentation; or
- create a new versioned manifest.

This preserves provenance and prevents later documentation maintenance from silently altering historical attestations.

## What the local regression proves

The permanent split regression proves the tested Registry behavior, wire-model conformance, and composed Main semantics represented by its harness.

It explicitly does **not** claim proof of native cross-contract network routing. Do not reinterpret `NATIVE_CROSS_CONTRACT_ROUTING_PROVEN=NO` as `YES`.

## What the finalized deployment evidence proves

The Bradbury evidence record separately proves the observed finalized deployment identities and the finalized Main constructor binding to the Registry address.

## Current production status

Current runtime/release status is maintained in [`../docs/RELEASE.md`](../docs/RELEASE.md).

The current production frontend is:

`https://memoryseal-umber.vercel.app`

The current verified runtime release source is merge commit:

`bdaa4cfffecd3f9600a90806b8f58a21defff1e8`

Current runtime tree:

`9a2416f7a52704ec178e7f616b1f6029091edf04`

Current frontend subtree:

`ceb807be22fe9ffe6609a493acba4172f0a760c6`

Current production deployment:

`dpl_39p94JZpXBU9BpvVzVnsvGtjiH1T`

The corresponding reviewer wallet fix commit is:

`19e74baca9ad8ff85677448b43b3246070ee55a7`

Historical machine-readable deployment/finality evidence remains immutable and continues to describe the contract-release workflow at the time each artifact was captured.
