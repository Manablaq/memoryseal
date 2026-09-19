import type { TransactionHash } from "genlayer-js/types";

import {
  formatMemorySealError,
  isMemorySealUserRejectedError,
} from "./errors";
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
      phase: isMemorySealUserRejectedError(error)
        ? "user_rejected"
        : "failed_before_submission",
      error: formatMemorySealError(
        error,
        "Wallet transaction submission failed.",
      ),
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
      error: formatMemorySealError(
        error,
        "Transaction tracking failed after submission.",
      ),
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
      error: formatMemorySealError(
        error,
        "Finalization tracking failed.",
      ),
    };
    emit(state);
    return state;
  }
}
