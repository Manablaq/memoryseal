import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";

import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";

import type { MemorySealReadTransport } from "./reader";

export const MEMORYSEAL_GENLAYER_READ_POLICY = {
  chain: "testnetBradbury",
  chainId: 4221,
  transactionHashVariant: "LATEST_FINAL",
  walletRequired: false,
  nonFinalReadsUsedForCanonicalTruth: false,
} as const;

export const assertMemorySealBradburySdkChain = (): void => {
  if (testnetBradbury.id !== MEMORYSEAL_DEPLOYMENT.network.chainId) {
    throw new Error(
      `GenLayerJS Bradbury chain mismatch: ${testnetBradbury.id}`,
    );
  }

  const sdkRpc = testnetBradbury.rpcUrls.default.http[0];
  if (sdkRpc !== MEMORYSEAL_DEPLOYMENT.network.rpcUrl) {
    throw new Error(`GenLayerJS Bradbury RPC mismatch: ${sdkRpc}`);
  }
};

export const createBradburyFinalReadTransport =
  (): MemorySealReadTransport => {
    assertMemorySealBradburySdkChain();

    const client = createClient({
      chain: testnetBradbury,
    });

    return {
      async readContract(request) {
        return client.readContract({
          address: request.address,
          functionName: request.functionName,
          args: [...request.args] as never[],
          transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
        });
      },
    };
  };
