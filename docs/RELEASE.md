# MemorySeal current release

This document is the human-readable release index for the current public MemorySeal deployment.

## Status

**Production verified — 15 September 2026**

The release consists of finalized Bradbury contracts plus a separately hardened and verified public frontend.

## Contract deployment

Network:

- GenLayer Bradbury testnet
- chain ID `4221`
- RPC `https://rpc-bradbury.genlayer.com`

Canonical contracts:

| Role | Address | Deployment transaction | Source SHA-256 |
| --- | --- | --- | --- |
| Registry | `0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B` | `0x898aeb539d521f5f72aae2d92872ce0dad5716a70e3c64d4f79b9b0f74a0d160` | `ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b` |
| Main | `0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64` | `0x1ad87fe39cb422ccdd8697a0dff82db60bb73ddd210a631b7f09c38097c88386` | `4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c` |

The deployed contract lineage is recorded in the frontend release configuration as:

- contract source release commit: `0bdd8a6f0ffb4b6357d313eff0a3a4ed6704a8cb`
- contract source release tree: `32958bde41c4927d1302f5f77c6792f447ab9a92`

The later hardening work did not modify the canonical deployed contract bytes.

## Finalized contract evidence

Primary finalized evidence:

[`../verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json`](../verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json)

The evidence records the finalized Main source identity and verifies that finalized Main `get_registry()` returned:

`0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B`

## Frontend hardening lineage

Verified hardening base:

- commit `3256b7e8f59b6cb696d8f15fa781a6a689829caa`
- tree `ff5ff7958b42a3e1a3070e47bc4181a0168ceca5`

Production runtime release:

- commit `aef280f787187d8ccc65728ab8603aa69fdd162c`
- tree `f7f0bc5edb50dd9bc91597c46324b392dae9b49e`
- frontend subtree `e45210e8d90e587d8a1b0a32e08d2c486c633d8f`
- release commit subject: `Harden MemorySeal recovery and release safeguards`

The hardening release changed 28 reviewed files while leaving both canonical deployed contract blobs unchanged.

## Production Vercel deployment

Existing Vercel project:

- project name: `memoryseal`
- project ID: `prj_KsjFx0b3PsGNOVtG7D3K6EGuEXSs`
- team ID: `team_CeSRrYN8DzdnSCjX4A7ZGEAs`

Verified production deployment:

- deployment ID: `dpl_DaExrMDmPEfT8qe4Cdq8qokgT9HQ`
- immutable deployment URL: `https://memoryseal-3c5zr2n4x-mr-albert-s-projects.vercel.app`
- canonical production alias: `https://memoryseal-umber.vercel.app`

Deployment metadata binds:

- release commit `aef280f787187d8ccc65728ab8603aa69fdd162c`;
- release tree `f7f0bc5edb50dd9bc91597c46324b392dae9b49e`;
- frontend tree `e45210e8d90e587d8a1b0a32e08d2c486c633d8f`; and
- reviewed patch SHA-256 `3e693e9b0485ee7dea52811cdb0edcf6f8b14002ac300160b26fd182fcde40f1`.

Independent post-deployment verification confirmed:

- Vercel status `READY`;
- `/` HTTP `200`;
- `/app` HTTP `200`;
- hardened production content present;
- production security headers present;
- canonical contract hashes unchanged; and
- Git release identity preserved.

## CI

The `main` push for runtime release commit `aef280f787187d8ccc65728ab8603aa69fdd162c` completed the GitHub Actions `CI` workflow successfully.

The frontend CI gates include:

- pinned Node/npm verification;
- frozen dependency install;
- production dependency audit;
- lint;
- TypeScript typecheck;
- unit tests;
- production build; and
- Chromium E2E.

## Why no new contract deployment was required

The release weaknesses were in browser/release boundaries rather than canonical contract semantics.

Hardening covered areas including:

- Bradbury wallet-chain enforcement;
- canonical contract/write restrictions;
- transaction journal context binding;
- ambiguous-submission recovery without auto-resubmission;
- portable recovery UX;
- security headers;
- dependency audit;
- monitoring;
- reviewer clarity; and
- historical/canonical source labeling.

Because those changes did not require altering the canonical Main or Registry logic, redeploying new contracts would have created unnecessary deployment risk and broken the existing finalized source identity.

## Documentation-only maintenance after this release

Repository documentation may evolve after the runtime release.

A documentation-only commit must not be described as a new runtime or contract deployment unless runtime source or deployment state actually changes.

For documentation maintenance intended to preserve the current production identity:

- do not modify `frontend/`;
- do not modify either canonical contract source;
- do not rewrite historical verification JSON;
- keep the release identities in this document explicit.

If a future change modifies the frontend runtime tree, create a new frontend release identity and re-verify production.

If a future change modifies a canonical contract, use a new contract release/deployment/finality process.
