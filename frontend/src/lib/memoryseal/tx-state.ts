import type { TransactionHash } from "genlayer-js/types";

export type MemorySealTransactionPhase =
  | "idle"
  | "connecting_wallet"
  | "switching_network"
  | "ready"
  | "awaiting_signature"
  | "submitted"
  | "waiting_decision"
  | "decision_observed"
  | "waiting_finalization"
  | "finalized_success"
  | "finalized_failed"
  | "user_rejected"
  | "failed_before_submission"
  | "ambiguous_after_submission"
  | "resuming_finalization";

export interface MemorySealTransactionSnapshot {
  statusName: string | null;
  txExecutionResultName: string | null;
  sdkSuccessful: boolean;
}

export interface MemorySealTransactionState {
  phase: MemorySealTransactionPhase;
  txHash?: TransactionHash;
  decision?: MemorySealTransactionSnapshot;
  finalization?: MemorySealTransactionSnapshot;
  error?: string;
}

export const INITIAL_MEMORYSEAL_TRANSACTION_STATE: MemorySealTransactionState = {
  phase: "idle",
};

export const MEMORYSEAL_TRANSACTION_POLICY = {
  acceptedAloneIsDurableSuccess: false,
  finalizationRequiredForDurableSuccess: true,
  executionSuccessRequired: true,
  automaticResubmissionAfterHash: false,
  automaticReplacementAfterHash: false,
  resumeByRecordedTransactionHash: true,
  advancedLifecycleRpcUsed: false,
} as const;

export function isDurableMemorySealSuccess(
  snapshot: MemorySealTransactionSnapshot,
): boolean {
  return (
    snapshot.statusName?.toUpperCase() === "FINALIZED" &&
    snapshot.txExecutionResultName?.toUpperCase() === "FINISHED_WITH_RETURN" &&
    snapshot.sdkSuccessful
  );
}

export function finalStateFromSnapshot(
  txHash: TransactionHash,
  snapshot: MemorySealTransactionSnapshot,
): MemorySealTransactionState {
  if (isDurableMemorySealSuccess(snapshot)) {
    return {
      phase: "finalized_success",
      txHash,
      finalization: snapshot,
    };
  }

  return {
    phase: "finalized_failed",
    txHash,
    finalization: snapshot,
  };
}

export function canSafelyResubmit(
  state: MemorySealTransactionState,
): boolean {
  return state.txHash === undefined;
}

export function transactionStateLabel(
  state: MemorySealTransactionState,
): string {
  switch (state.phase) {
    case "idle":
      return "No transaction prepared";
    case "connecting_wallet":
      return "Connecting wallet";
    case "switching_network":
      return "Switching wallet to Bradbury";
    case "ready":
      return "Wallet ready";
    case "awaiting_signature":
      return "Waiting for wallet signature";
    case "submitted":
      return "Transaction submitted";
    case "waiting_decision":
      return "Waiting for a materialized decision";
    case "decision_observed":
      return "Decision observed — finalization still required";
    case "waiting_finalization":
      return "Waiting for finalization";
    case "finalized_success":
      return "Finalized with successful execution";
    case "finalized_failed":
      return "Finalized without successful execution";
    case "user_rejected":
      return "Wallet request rejected";
    case "failed_before_submission":
      return "Submission failed before a transaction hash existed";
    case "ambiguous_after_submission":
      return "Outcome uncertain — resume by transaction hash, do not resubmit";
    case "resuming_finalization":
      return "Resuming finalization tracking";
  }
}
