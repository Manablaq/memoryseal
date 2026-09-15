# Security policy

MemorySeal is a GenLayer Bradbury testnet project. This document describes the security boundaries of the current public release and the rules for reporting security issues.

## Supported release

The supported public release uses:

- GenLayer Bradbury testnet, chain ID `4221`;
- Main contract `0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64`;
- Registry contract `0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B`;
- production frontend `https://memoryseal-umber.vercel.app`;
- durable consequential reads using `TransactionHashVariant.LATEST_FINAL`.

The canonical contract source identities are documented in [`contracts/README.md`](contracts/README.md), and the current release identities are documented in [`docs/RELEASE.md`](docs/RELEASE.md).

## Security boundaries

MemorySeal relies on several independent boundaries.

### Evidence authority

A URL or content digest is not treated as authority by itself. Sealed policies bind:

- approved issuer addresses;
- approved HTTPS publisher origins;
- minimum evidence count;
- minimum distinct issuers;
- minimum distinct origins;
- evidence freshness;
- minimum remaining validity;
- maximum claim lifetime;
- maximum evidence records; and
- maximum claim content size.

Evidence records also bind stable record identities, strictly increasing versions, issuer/origin lineage, source URL, digest, issue time, expiry, and registration time.

### Consensus-to-consequence binding

Claim review resolves the consequential MemorySeal claim state. `REPAIR_REQUIRED`, `REJECTED`, `EXPIRED`, `CANCELED`, `SUPERSEDED`, and `SUPPORTED` remain distinct protocol outcomes.

The public frontend must not treat a provisional transaction state as canonical protocol state.

### Liveness

Claims have bounded review windows. Proposers may cancel eligible claims, and eligible stale claims may be expired after their deadline. Repair flows remain bounded by the parent review window.

### Browser wallet writes

The browser write surface:

- requires an injected/provider-backed wallet;
- never contains or requests a private key or seed phrase;
- verifies Bradbury chain ID `4221`;
- restricts writes to the canonical Main/Registry addresses;
- restricts writes to the ten frozen MemorySeal write methods.

### Ambiguous submission and recovery

An ambiguous wallet/RPC result must not trigger automatic resubmission.

Transaction journal v2 records contextual binding for a submitted transaction:

- transaction hash;
- chain;
- wallet account;
- canonical contract;
- write method; and
- timestamp.

Recovery tracking resumes observation of an existing transaction. It never silently sends the write again. Legacy hash-only recovery remains supported without inventing missing context.

### Deployment integrity

The finalized Main and Registry source files are deployment authority. Historical candidate, monolithic, and probe contract files are explicitly non-canonical.

A frontend or documentation hardening change must not be described as a contract upgrade unless the canonical contract source bytes actually change and a new deployment/finality process is completed.

## Web security controls

Production responses are configured with defense-in-depth headers including:

- Content Security Policy;
- HTTP Strict Transport Security;
- `X-Content-Type-Options`;
- `X-Frame-Options`;
- Referrer Policy; and
- Permissions Policy.

The CSP limits network connections to the application origin and the configured GenLayer testnet RPC origins required by the application.

## Dependency and operational controls

CI pins the Node.js/npm toolchain, installs from the frozen lockfile, audits production dependencies, and runs lint, typecheck, unit tests, production build, and Chromium E2E coverage.

A scheduled monitor checks the production routes and verifies that the Bradbury RPC reports the expected chain ID.

## Sensitive information

Never commit or include any of the following in an issue, pull request, test fixture, screenshot, log, or evidence packet:

- private keys;
- seed phrases;
- wallet recovery material;
- passwords;
- API tokens;
- access tokens;
- session cookies; or
- unpublished vulnerability details that would enable exploitation.

Use `.env` or local secret-management facilities for development-only configuration. Environment files are intentionally excluded from version control.

## Reporting a vulnerability

Do not publish a working exploit or secret material in a public issue.

If GitHub private vulnerability reporting is available for this repository, use it. Otherwise, open a minimal issue stating that you need a private security contact channel; do not include exploit details in that public issue.

A useful report should include:

- affected release/commit;
- affected contract or frontend component;
- impact;
- reproducible steps;
- whether the issue requires a blockchain write;
- whether funds, authorization, canonical state, or evidence trust can be affected; and
- a proposed mitigation, if known.

## Out of scope for security claims

This repository does not claim:

- mainnet deployment;
- proof that arbitrary external URLs are trustworthy;
- proof of native cross-contract network routing from the local composed regression harness; or
- automatic safe retry of ambiguous blockchain submissions.

See [`docs/VERIFICATION.md`](docs/VERIFICATION.md) for the exact verification boundaries.
