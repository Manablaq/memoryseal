# MemorySeal architecture

MemorySeal is a two-contract GenLayer protocol plus a public frontend. The architecture separates evidence-policy authority from claim consensus and canonical subject memory.

## Components

```text
Approved issuers
      │
      ▼
┌────────────────────┐
│ MemorySeal Registry│
│ policies + evidence│
└─────────┬──────────┘
          │ strict wire views
          ▼
┌────────────────────┐
│   MemorySeal Main  │
│ claims + consensus │
│ + subject memory   │
└─────────┬──────────┘
          │ finalized reads / bounded writes
          ▼
┌────────────────────┐
│ Public Next.js UI  │
│ Bradbury chain 4221│
└────────────────────┘
```

## Registry contract

Canonical source:

`contracts/memoryseal_registry.py`

The Registry owns two principal record types.

### Policy

A policy binds:

- policy owner;
- slug and version;
- minimum evidence records;
- minimum distinct issuers;
- minimum distinct publisher origins;
- maximum evidence age;
- minimum remaining evidence validity;
- maximum claim lifetime;
- maximum evidence records;
- maximum claim content size;
- approved issuer commitment;
- approved origin commitment; and
- a sealed policy fingerprint.

A policy is mutable only before sealing. Sealing requires the configured issuer/origin minimums to be satisfied.

### Evidence

An evidence record binds:

- policy ID;
- stable record ID;
- monotonically increasing version;
- issuer;
- HTTPS source URL;
- canonical HTTPS publisher origin;
- SHA-256 digest;
- issue time;
- expiry; and
- registration time.

Evidence registration requires an approved issuer and approved origin. The Registry preserves issuer/origin lineage for each `(policy, stable_record_id)` lineage and rejects version regression.

### Registry wire interface

The Main consumes strict Registry views:

- `get_policy_wire`
- `get_evidence_wire`

The split regression includes an explicit wire-conformance test because cross-contract compatibility is a consequence boundary.

## Main contract

Canonical source:

`contracts/memoryseal_claim_consensus.py`

The Main owns claims, claim evidence bindings, and subject history.

A claim binds:

- sequence and claim ID;
- subject ID;
- canonical claim text/hash;
- policy ID and policy fingerprint;
- proposer;
- evidence count;
- source-set digest;
- earliest evidence expiry;
- optional supersession/repair relationships;
- explicit state/reason;
- review deadline;
- review/finality timestamps; and
- validity bounds.

## Proposal checks

Before a claim becomes `REVIEWABLE`, the Main verifies the policy/evidence constraints exposed by the Registry.

The proposal path includes checks for:

- a sealed policy;
- canonical subject and claim text;
- evidence-count bounds;
- strictly ordered evidence IDs;
- policy match;
- latest evidence version;
- freshness and remaining validity;
- unique stable records;
- unique evidence digests;
- required distinct issuers;
- required distinct origins;
- supersession compatibility; and
- a non-empty bounded review window.

## State model

MemorySeal uses explicit states:

```text
                 ┌───────────────┐
                 │  REVIEWABLE   │
                 └───────┬───────┘
                         │
       ┌─────────────────┼───────────────────┐
       │                 │                   │
       ▼                 ▼                   ▼
  SUPPORTED          REJECTED        REPAIR_REQUIRED
       │                                      │
       │                                      └── repair child proposal
       │
       └── later supported supersession may produce SUPERSEDED

REVIEWABLE / eligible repair parent
       ├── proposer closure ──> CANCELED
       └── deadline elapsed ──> EXPIRED
```

The states are intentionally not interchangeable. A repairable evidence problem is not the same consequence as rejection, and expiry is not the same consequence as an adverse review.

## Subject memory

The Main maintains:

- recorded subject head;
- effective subject head;
- subject history count; and
- indexed subject history claim IDs.

Only supported claims can advance canonical subject memory. Effective head reads additionally respect claim validity.

This recorded/effective distinction prevents an expired supported claim from being silently presented as currently effective.

## Finality boundary

The public frontend uses `TransactionHashVariant.LATEST_FINAL` when finality is consequential.

The UI may display transaction progress, but provisional state must not be represented as canonical MemorySeal protocol state.

## Browser write boundary

The frontend exposes ten write methods:

Registry:

1. `create_policy`
2. `add_policy_issuer`
3. `add_policy_origin`
4. `seal_policy`
5. `register_evidence`

Main:

6. `propose_claim`
7. `propose_repair_claim`
8. `cancel_claim`
9. `expire_claim`
10. `review_claim`

Browser writes are additionally bound to:

- Bradbury chain ID `4221`;
- canonical contract addresses; and
- the injected wallet account.

## Transaction ambiguity and recovery

Transaction journal v2 records:

- transaction hash;
- chain;
- wallet;
- contract;
- method; and
- timestamp.

On reload or an ambiguous RPC response, MemorySeal resumes observation of the recorded transaction. It does not automatically resubmit the underlying write.

Legacy hash-only recovery remains supported without fabricating chain/account/method context that was never recorded.

## Deployment identity

Current finalized contracts:

- Main: `0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64`
- Registry: `0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B`

See [`RELEASE.md`](RELEASE.md) for exact source and frontend release identities.
