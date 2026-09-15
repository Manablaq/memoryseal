import { describe, expect, it } from "vitest";
import { assertMemorySealWalletChainId, MEMORYSEAL_BROWSER_WALLET_POLICY } from "./browser-wallet";

describe("MemorySeal browser wallet policy", () => {
  it("accepts only Bradbury chain ID 4221", () => {
    expect(MEMORYSEAL_BROWSER_WALLET_POLICY.chainId).toBe(4221);
    expect(() => assertMemorySealWalletChainId("0x107d")).not.toThrow();
    expect(() => assertMemorySealWalletChainId(4221)).not.toThrow();
    expect(() => assertMemorySealWalletChainId(BigInt(4221))).not.toThrow();
    expect(() => assertMemorySealWalletChainId("0x1")).toThrow(/Bradbury chain ID 4221/i);
    expect(() => assertMemorySealWalletChainId("4221")).toThrow(/Bradbury chain ID 4221/i);
  });
});
