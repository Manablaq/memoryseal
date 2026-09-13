import { describe, expect, it } from "vitest";
import type { TransactionHash } from "genlayer-js/types";

import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";
import {
  resumeMemorySealFinalization,
  submitAndTrackMemorySealIntent,
  type MemorySealFinalizationTracker,
  type MemorySealWriteTransport,
} from "./transaction-runner";
import {
  canSafelyResubmit,
  isDurableMemorySealSuccess,
  type MemorySealTransactionState,
} from "./tx-state";
import type { MemorySealWriteIntent } from "./write-intents";

const HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as TransactionHash;

const intent: MemorySealWriteIntent<"seal_policy"> = {
  address: MEMORYSEAL_DEPLOYMENT.contracts.registry,
  functionName: "seal_policy",
  args: ["policy-1"],
  value: BigInt(0),
};

const accepted = {
  statusName: "ACCEPTED",
  txExecutionResultName: "FINISHED_WITH_RETURN",
  sdkSuccessful: true,
};

const finalizedSuccess = {
  statusName: "FINALIZED",
  txExecutionResultName: "FINISHED_WITH_RETURN",
  sdkSuccessful: true,
};

const finalizedError = {
  statusName: "FINALIZED",
  txExecutionResultName: "FINISHED_WITH_ERROR",
  sdkSuccessful: false,
};

describe("MemorySeal deterministic transaction state machine", () => {
  it("never treats Accepted alone as durable success", () => {
    expect(isDurableMemorySealSuccess(accepted)).toBe(false);
    expect(isDurableMemorySealSuccess(finalizedSuccess)).toBe(true);
  });

  it("submits once, observes a decision, then requires finalization for success", async () => {
    let submits = 0;
    const states: MemorySealTransactionState[] = [];

    const transport: MemorySealWriteTransport = {
      async submit() {
        submits += 1;
        return HASH;
      },
      async waitForDecision() {
        return accepted;
      },
      async waitForFinalization() {
        return finalizedSuccess;
      },
    };

    const result = await submitAndTrackMemorySealIntent(
      intent,
      transport,
      (state) => states.push(state),
    );

    expect(submits).toBe(1);
    expect(states.map((state) => state.phase)).toEqual([
      "awaiting_signature",
      "submitted",
      "waiting_decision",
      "decision_observed",
      "waiting_finalization",
      "finalized_success",
    ]);
    expect(result.phase).toBe("finalized_success");
    expect(canSafelyResubmit(result)).toBe(false);
  });

  it("surfaces finalized execution failure as failure", async () => {
    const transport: MemorySealWriteTransport = {
      async submit() {
        return HASH;
      },
      async waitForDecision() {
        return accepted;
      },
      async waitForFinalization() {
        return finalizedError;
      },
    };

    const result = await submitAndTrackMemorySealIntent(
      intent,
      transport,
      () => undefined,
    );

    expect(result.phase).toBe("finalized_failed");
    expect(canSafelyResubmit(result)).toBe(false);
  });

  it("turns uncertainty after submission into hash-based recovery, never a retry", async () => {
    let submits = 0;
    const transport: MemorySealWriteTransport = {
      async submit() {
        submits += 1;
        return HASH;
      },
      async waitForDecision() {
        throw new Error("temporary RPC interruption");
      },
      async waitForFinalization() {
        throw new Error("not reached");
      },
    };

    const result = await submitAndTrackMemorySealIntent(
      intent,
      transport,
      () => undefined,
    );

    expect(submits).toBe(1);
    expect(result.phase).toBe("ambiguous_after_submission");
    expect(result.txHash).toBe(HASH);
    expect(canSafelyResubmit(result)).toBe(false);
  });

  it("distinguishes wallet rejection before any transaction hash exists", async () => {
    const transport: MemorySealWriteTransport = {
      async submit() {
        throw Object.assign(new Error("User rejected"), { code: 4001 });
      },
      async waitForDecision() {
        throw new Error("not reached");
      },
      async waitForFinalization() {
        throw new Error("not reached");
      },
    };

    const result = await submitAndTrackMemorySealIntent(
      intent,
      transport,
      () => undefined,
    );

    expect(result.phase).toBe("user_rejected");
    expect(result.txHash).toBeUndefined();
    expect(canSafelyResubmit(result)).toBe(true);
  });

  it("resumes a known transaction by hash without submitting anything", async () => {
    let finalizationCalls = 0;
    const states: MemorySealTransactionState[] = [];

    const tracker: MemorySealFinalizationTracker = {
      async waitForFinalization(hash) {
        expect(hash).toBe(HASH);
        finalizationCalls += 1;
        return finalizedSuccess;
      },
    };

    const result = await resumeMemorySealFinalization(
      HASH,
      tracker,
      (state) => states.push(state),
    );

    expect(finalizationCalls).toBe(1);
    expect(states.map((state) => state.phase)).toEqual([
      "resuming_finalization",
      "finalized_success",
    ]);
    expect(result.phase).toBe("finalized_success");
  });
});
