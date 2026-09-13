import { describe, expect, it } from "vitest";

import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";

import {
  MEMORYSEAL_GENLAYER_READ_POLICY,
  assertMemorySealBradburySdkChain,
} from "./genlayer-read";

describe("MemorySeal GenLayer read adapter", () => {
  it("binds the SDK Bradbury definition to the frozen deployment", () => {
    expect(() => assertMemorySealBradburySdkChain()).not.toThrow();
    expect(MEMORYSEAL_GENLAYER_READ_POLICY.chainId).toBe(
      MEMORYSEAL_DEPLOYMENT.network.chainId,
    );
  });

  it("requires durable finalized reads and no wallet", () => {
    expect(MEMORYSEAL_GENLAYER_READ_POLICY.transactionHashVariant).toBe(
      "LATEST_FINAL",
    );
    expect(MEMORYSEAL_GENLAYER_READ_POLICY.walletRequired).toBe(false);
    expect(
      MEMORYSEAL_GENLAYER_READ_POLICY.nonFinalReadsUsedForCanonicalTruth,
    ).toBe(false);
  });
});
