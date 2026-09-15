"use client";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus, type TransactionHash } from "genlayer-js/types";

import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";
import type { AddressHex } from "./types";
import type { MemorySealWriteIntent } from "./write-intents";
import type {
  MemorySealFinalizationTracker,
  MemorySealWriteTransport,
} from "./transaction-runner";
import type { MemorySealTransactionSnapshot } from "./tx-state";

import {
  clearMemorySealPendingTransaction,
  recordMemorySealPendingTransaction,
} from "./tx-journal";

export interface MemorySealEip1193Provider {
  request(args: {
    method: string;
    params?: readonly unknown[] | object;
  }): Promise<unknown>;
}

export interface MemorySealWalletSession {
  address: AddressHex;
  transport: MemorySealWriteTransport;
}

export const MEMORYSEAL_BROWSER_WALLET_POLICY = {
  network: "testnetBradbury",
  chainId: 4221,
  providerBackedWritesOnly: true,
  privateKeyInBrowserAllowed: false,
  arbitraryContractAddressAllowed: false,
  arbitraryMethodAllowed: false,
  automaticRetryAfterSubmission: false,
  automaticReplacementAfterSubmission: false,
  advancedLifecycleRpcUsed: false,
} as const;

export function getInjectedMemorySealProvider(): MemorySealEip1193Provider {
  if (typeof window === "undefined") {
    throw new Error("Browser wallet access is unavailable during server rendering.");
  }

  const candidate = (
    window as typeof window & {
      ethereum?: MemorySealEip1193Provider;
    }
  ).ethereum;

  if (!candidate || typeof candidate.request !== "function") {
    throw new Error("No EIP-1193 browser wallet was detected.");
  }

  return candidate;
}

const assertAddress = (value: unknown): AddressHex => {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value)
  ) {
    throw new Error("Wallet returned an invalid account address.");
  }
  return value as AddressHex;
};

export function parseMemorySealTransactionHash(
  value: string,
): TransactionHash {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Transaction hash must be a 32-byte 0x-prefixed hash.");
  }
  return value as TransactionHash;
}

export function assertMemorySealWalletChainId(value: unknown): void {
  let chainId: number | null = null;
  if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) {
    chainId = Number.parseInt(value.slice(2), 16);
  } else if (typeof value === "number" && Number.isSafeInteger(value)) {
    chainId = value;
  } else if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    chainId = Number(value);
  }
  if (chainId !== MEMORYSEAL_DEPLOYMENT.network.chainId) {
    throw new Error("Wallet is not connected to the exact Bradbury chain ID 4221.");
  }
}

export const MEMORYSEAL_DECISION_TRACKING_TIMEOUT_MS =
  15 * 60 * 1_000;

export const MEMORYSEAL_FINALIZATION_TRACKING_TIMEOUT_MS =
  60 * 60 * 1_000;

const withMemorySealTrackingTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  stage: string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(
        new Error(
          `Timed out while tracking MemorySeal ${stage}. ` +
            "The transaction may still be progressing. " +
            "Do not resubmit it; resume tracking with the recorded transaction hash.",
        ),
      );
    }, timeoutMs);

    operation.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });

const snapshot = (receipt: {
  statusName?: unknown;
  txExecutionResultName?: unknown;
}): MemorySealTransactionSnapshot => {
  const statusName =
    typeof receipt.statusName === "string" ? receipt.statusName : null;
  const txExecutionResultName =
    typeof receipt.txExecutionResultName === "string"
      ? receipt.txExecutionResultName
      : null;

  return {
    statusName,
    txExecutionResultName,
    sdkSuccessful:
      (statusName === TransactionStatus.ACCEPTED ||
        statusName === TransactionStatus.FINALIZED) &&
      txExecutionResultName === "FINISHED_WITH_RETURN",
  };
};

export async function connectMemorySealWallet(
  provider: MemorySealEip1193Provider = getInjectedMemorySealProvider(),
): Promise<MemorySealWalletSession> {
  const accounts = await provider.request({
    method: "eth_requestAccounts",
  });

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Wallet returned no account.");
  }

  const address = assertAddress(accounts[0]);

  const client = createClient({
    chain: testnetBradbury,
    account: address,
    provider: provider as never,
  });

  await client.connect("testnetBradbury");

  assertMemorySealWalletChainId(
    await provider.request({ method: "eth_chainId" }),
  );

  const transport: MemorySealWriteTransport = {
    async submit(intent: MemorySealWriteIntent) {
      if (
        intent.address !== MEMORYSEAL_DEPLOYMENT.contracts.main &&
        intent.address !== MEMORYSEAL_DEPLOYMENT.contracts.registry
      ) {
        throw new Error("Write intent target is outside the frozen MemorySeal deployment.");
      }

      const hash = await client.writeContract({
        address: intent.address,
        functionName: intent.functionName,
        args: [...intent.args] as never[],
        value: intent.value,
      });

      recordMemorySealPendingTransaction(hash, {
        chainId: MEMORYSEAL_DEPLOYMENT.network.chainId,
        account: address,
        contractAddress: intent.address,
        functionName: intent.functionName,
      });

      return hash;
    },

    async waitForDecision(hash) {
      const receipt = await withMemorySealTrackingTimeout(
        client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.ACCEPTED,
        }),
        MEMORYSEAL_DECISION_TRACKING_TIMEOUT_MS,
        "consensus decision",
      );

      return snapshot(receipt);
    },

    async waitForFinalization(hash) {
      const receipt = await withMemorySealTrackingTimeout(
        client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.FINALIZED,
        }),
        MEMORYSEAL_FINALIZATION_TRACKING_TIMEOUT_MS,
        "stored finality",
      );

      clearMemorySealPendingTransaction(hash);

      return snapshot(receipt);
    },
  };

  return {
    address,
    transport,
  };
}

export function createMemorySealFinalizationTracker(): MemorySealFinalizationTracker {
  const client = createClient({
    chain: testnetBradbury,
  });

  return {
    async waitForFinalization(hash) {
      const receipt = await withMemorySealTrackingTimeout(
        client.waitForTransactionReceipt({
          hash,
          status: TransactionStatus.FINALIZED,
        }),
        MEMORYSEAL_FINALIZATION_TRACKING_TIMEOUT_MS,
        "stored finality",
      );

      clearMemorySealPendingTransaction(hash);

      return snapshot(receipt);
    },
  };
}
