import { describe, expect, it } from "vitest";

import {
  assertMemorySealWalletChainId,
  connectMemorySealWallet,
  ensureMemorySealBradburyNetwork,
  MEMORYSEAL_BRADBURY_WALLET_CHAIN,
  MEMORYSEAL_BROWSER_WALLET_POLICY,
  MemorySealWalletProviderError,
  type MemorySealEip1193Provider,
} from "./browser-wallet";
import { formatMemorySealError } from "./errors";

const walletAddress =
  "0x1212121212121212121212121212121212121212";

describe("MemorySeal browser wallet policy", () => {
  it("accepts only Bradbury chain ID 4221", () => {
    expect(MEMORYSEAL_BROWSER_WALLET_POLICY.chainId).toBe(4221);
    expect(MEMORYSEAL_BRADBURY_WALLET_CHAIN.chainId).toBe("0x107d");
    expect(MEMORYSEAL_BRADBURY_WALLET_CHAIN.rpcUrls).toEqual([
      "https://rpc-bradbury.genlayer.com",
    ]);
    expect(MEMORYSEAL_BRADBURY_WALLET_CHAIN.nativeCurrency.symbol).toBe(
      "GEN",
    );

    expect(() => assertMemorySealWalletChainId("0x107d")).not.toThrow();
    expect(() => assertMemorySealWalletChainId(4221)).not.toThrow();
    expect(() => assertMemorySealWalletChainId(BigInt(4221))).not.toThrow();
    expect(() => assertMemorySealWalletChainId("0x1")).toThrow(
      /Bradbury chain ID 4221/i,
    );
    expect(() => assertMemorySealWalletChainId("4221")).toThrow(
      /Bradbury chain ID 4221/i,
    );
  });

  it("switches a generic injected EIP-1193 wallet to Bradbury without Snap calls", async () => {
    let chainId = "0x1";
    const requests: string[] = [];

    const provider: MemorySealEip1193Provider = {
      async request({ method, params }) {
        requests.push(method);

        switch (method) {
          case "eth_requestAccounts":
            return [walletAddress];
          case "eth_chainId":
            return chainId;
          case "wallet_switchEthereumChain":
            expect(params).toEqual([{ chainId: "0x107d" }]);
            chainId = "0x107d";
            return null;
          default:
            throw new Error(`Unexpected request: ${method}`);
        }
      },
    };

    const session = await connectMemorySealWallet(provider);

    expect(session.address).toBe(walletAddress);
    expect(requests).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);
    expect(requests).not.toContain("wallet_getSnaps");
    expect(requests).not.toContain("wallet_requestSnaps");
  });

  it("adds Bradbury only when the wallet reports unknown chain 4902, then verifies 4221", async () => {
    let chainId = "0x1";
    let added = false;
    let switchAttempts = 0;
    const requests: string[] = [];

    const provider: MemorySealEip1193Provider = {
      async request({ method, params }) {
        requests.push(method);

        switch (method) {
          case "eth_chainId":
            return chainId;
          case "wallet_switchEthereumChain":
            switchAttempts += 1;
            if (!added) {
              throw {
                code: 4902,
                message: "Unrecognized chain ID.",
              };
            }
            expect(params).toEqual([{ chainId: "0x107d" }]);
            chainId = "0x107d";
            return null;
          case "wallet_addEthereumChain": {
            const values = params as readonly unknown[];
            expect(values[0]).toEqual(
              MEMORYSEAL_BRADBURY_WALLET_CHAIN,
            );
            added = true;
            return null;
          }
          default:
            throw new Error(`Unexpected request: ${method}`);
        }
      },
    };

    await ensureMemorySealBradburyNetwork(provider);

    expect(switchAttempts).toBe(2);
    expect(requests).toEqual([
      "eth_chainId",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);
  });

  it("preserves a structured provider rejection as a readable user-facing error", async () => {
    const provider: MemorySealEip1193Provider = {
      async request({ method }) {
        if (method === "eth_chainId") return "0x1";

        if (method === "wallet_switchEthereumChain") {
          throw {
            code: 4001,
            message: "User rejected the Bradbury network switch.",
          };
        }

        throw new Error(`Unexpected request: ${method}`);
      },
    };

    let caught: unknown;

    try {
      await ensureMemorySealBradburyNetwork(provider);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MemorySealWalletProviderError);
    expect((caught as MemorySealWalletProviderError).code).toBe(4001);

    const message = formatMemorySealError(caught);

    expect(message).toContain(
      "User rejected the Bradbury network switch.",
    );
    expect(message).toContain("provider code 4001");
    expect(message).not.toContain("[object Object]");
  });
});
