# MemorySeal frontend

This is the public frontend for the finalized MemorySeal Bradbury deployment.

- Durable reads use `TransactionHashVariant.LATEST_FINAL` where finality is consequential.
- Browser writes are restricted to the ten frozen methods and canonical Main/Registry addresses.
- Wallet sessions are verified against Bradbury chain ID `4221`.
- Injected-wallet setup uses standard EIP-1193 `wallet_switchEthereumChain` / `wallet_addEthereumChain` on the actual provider; connection does not require MetaMask Snap APIs.
- Structured provider failures are normalized to readable messages and error codes instead of rendering `[object Object]`.
- Pending journal v2 binds transaction hash, chain, wallet, contract, method, and timestamp.
- Legacy hash-only recovery remains supported without inventing missing context.
- Recovery tracking never automatically resubmits a write; users can copy a recovery hash for another browser/device.
- Response headers provide CSP, clickjacking, MIME-sniffing, referrer, permissions, and HSTS hardening.
- CI runs lint, typecheck, tests, build, production dependency audit, and Chromium E2E.
- A scheduled workflow monitors the production routes and Bradbury chain identity.

The finalized Intelligent Contract sources are not modified by frontend hardening. See `../contracts/README.md` and `../verification/MEMORYSEAL_BRADBURY_FINALIZED_MAIN_V1.json`.
