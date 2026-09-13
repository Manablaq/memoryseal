# MemorySeal frontend

This directory is the certified frontend foundation for MemorySeal Step 4.

Stage 4D establishes only:

- the pinned Next.js/React/GenLayerJS toolchain;
- the exact Bradbury chain and finalized MemorySeal deployment identities;
- deterministic lint, typecheck, unit-test, and production-build foundations;
- the boundary that no global protocol lists may be invented from count-only reads.

Product UI, typed protocol client logic, live Bradbury reads, wallet writes, and browser
E2E are implemented and certified in later Step 4 stages.

The Intelligent Contracts are frozen by the completed Step 3 release and are not
modified or redeployed by frontend work.
