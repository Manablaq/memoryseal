import type { TransactionHash } from "genlayer-js/types";

import type { MemorySealWriteIntent } from "./write-intents";
import {
  finalStateFromSnapshot,
  type MemorySealTransactionSnapshot,
  type MemorySealTransactionState,
} from "./tx-state";

export interface MemorySealFinalizationTracker {
  waitForFinalization(
    hash: TransactionHash,
  ): Promise<MemorySealTransactionSnapshot>;
}

export interface MemorySealWriteTransport
  extends MemorySealFinalizationTracker {
  submit(intent: MemorySealWriteIntent): Promise<TransactionHash>;
  waitForDecision(
    hash: TransactionHash,
  ): Promise<MemorySealTransactionSnapshot>;
}

export type MemorySealStateListener = (
  state: MemorySealTransactionState,
) => void;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const errorCode = (error: unknown): number | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  ) {
    return (error as { code: number }).code;
  }
  return undefined;
};

export async function submitAndTrackMemorySealIntent(
  intent: MemorySealWriteIntent,
  transport: MemorySealWriteTransport,
  emit: MemorySealStateListener,
): Promise<MemorySealTransactionState> {
  let hash: TransactionHash | undefined;

  emit({ phase: "awaiting_signature" });

  try {
    hash = await transport.submit(intent);
    emit({ phase: "submitted", txHash: hash });
  } catch (error) {
    const state: MemorySealTransactionState = {
      phase: errorCode(error) === 4001 ? "user_rejected" : "failed_before_submission",
      error: errorMessage(error),
    };
    emit(state);
    return state;
  }

  try {
    emit({ phase: "waiting_decision", txHash: hash });
    const decision = await transport.waitForDecision(hash);
    emit({
      phase: "decision_observed",
      txHash: hash,
      decision,
    });

    emit({
      phase: "waiting_finalization",
      txHash: hash,
      decision,
    });

    const finalization = await transport.waitForFinalization(hash);
    const state = finalStateFromSnapshot(hash, finalization);
    emit({
      ...state,
      decision,
    });
    return {
      ...state,
      decision,
    };
  } catch (error) {
    const state: MemorySealTransactionState = {
      phase: "ambiguous_after_submission",
      txHash: hash,
      error: errorMessage(error),
    };
    emit(state);
    return state;
  }
}

export async function resumeMemorySealFinalization(
  hash: TransactionHash,
  tracker: MemorySealFinalizationTracker,
  emit: MemorySealStateListener,
): Promise<MemorySealTransactionState> {
  emit({
    phase: "resuming_finalization",
    txHash: hash,
  });

  try {
    const finalization = await tracker.waitForFinalization(hash);
    const state = finalStateFromSnapshot(hash, finalization);
    emit(state);
    return state;
  } catch (error) {
    const state: MemorySealTransactionState = {
      phase: "ambiguous_after_submission",
      txHash: hash,
      error: errorMessage(error),
    };
    emit(state);
    return state;
  }
}
