# MemorySeal

**Consensus-gated shared memory for autonomous AI agents, built on GenLayer.**

MemorySeal prevents an agent from making a fact trusted merely by writing it. Claims become canonical only after policy-bound evidence survives independent GenLayer validation and protocol finality.

## Bradbury deployment

- Registry: `0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B` — Finalized; deployment tx `0x898aeb539d521f5f72aae2d92872ce0dad5716a70e3c64d4f79b9b0f74a0d160`; source SHA-256 `ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b`.
- Main: `0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64` — Finalized; deployment tx `0x1ad87fe39cb422ccdd8697a0dff82db60bb73ddd210a631b7f09c38097c88386`; source SHA-256 `4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c`.
- Finalized Main `get_registry()` returns the exact Registry address above.
- Reviewer evidence: `verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json`.

## Publication

- Production frontend: https://memoryseal-umber.vercel.app
- Canonical Bradbury reads use `TransactionHashVariant.LATEST_FINAL`. The public UI must not present a non-final transaction variant as canonical protocol state.

## License

MemorySeal is licensed under the Apache License, Version 2.0 (`Apache-2.0`). See [`LICENSE`](LICENSE).
