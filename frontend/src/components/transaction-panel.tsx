"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";

import {
  connectMemorySealWallet,
  createMemorySealFinalizationTracker,
  parseMemorySealTransactionHash,
  type MemorySealWalletSession,
} from "../lib/memoryseal/browser-wallet";
import {
  getMemorySealPendingTransactionHash,
  getMemorySealPendingTransactionServerHash,
  subscribeMemorySealPendingTransaction,
} from "../lib/memoryseal/tx-journal";
import {
  resumeMemorySealFinalization,
  submitAndTrackMemorySealIntent,
} from "../lib/memoryseal/transaction-runner";
import {
  INITIAL_MEMORYSEAL_TRANSACTION_STATE,
  transactionStateLabel,
  type MemorySealTransactionState,
} from "../lib/memoryseal/tx-state";
import {
  buildMemorySealWriteIntent,
  MEMORYSEAL_WRITE_ACTIONS,
  MEMORYSEAL_WRITE_FORMS,
  type MemorySealWriteAction,
} from "../lib/memoryseal/write-form";
import { shortenHex } from "../lib/memoryseal/ui-hooks";
import styles from "./transaction-panel.module.css";

export function TransactionPanel() {
  const [action, setAction] =
    useState<MemorySealWriteAction>("create_policy");
  const [values, setValues] = useState<Record<string, string>>({});
  const [session, setSession] = useState<MemorySealWalletSession | null>(null);
  const [state, setState] = useState<MemorySealTransactionState>(
    INITIAL_MEMORYSEAL_TRANSACTION_STATE,
  );
  const [formError, setFormError] = useState("");
  const [recoveryHashOverride, setRecoveryHash] =
    useState<string | null>(null);

  const recordedRecoveryHash = useSyncExternalStore(
    subscribeMemorySealPendingTransaction,
    getMemorySealPendingTransactionHash,
    getMemorySealPendingTransactionServerHash,
  );

  const recoveryHash =
    recoveryHashOverride ?? recordedRecoveryHash;

  const hasRecordedPendingTransaction = recordedRecoveryHash.length > 0;

  const form = MEMORYSEAL_WRITE_FORMS[action];

  const busy = useMemo(
    () =>
      [
        "connecting_wallet",
        "switching_network",
        "awaiting_signature",
        "submitted",
        "waiting_decision",
        "decision_observed",
        "waiting_finalization",
        "resuming_finalization",
      ].includes(state.phase),
    [state.phase],
  );

  async function connect() {
    setFormError("");
    setState({ phase: "connecting_wallet" });

    try {
      setState({ phase: "switching_network" });
      const connected = await connectMemorySealWallet();
      setSession(connected);
      setState({ phase: "ready" });
    } catch (error) {
      setSession(null);
      setState({
        phase:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === 4001
            ? "user_rejected"
            : "failed_before_submission",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (hasRecordedPendingTransaction) {
      setFormError(
        "A recorded transaction is still pending. Resume finalization by its " +
          "recorded hash before submitting another write.",
      );
      return;
    }

    if (!session) {
      setFormError("Connect a browser wallet on Bradbury before submitting.");
      return;
    }

    let intent;
    try {
      intent = buildMemorySealWriteIntent(action, values);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
      return;
    }

    await submitAndTrackMemorySealIntent(
      intent,
      session.transport,
      setState,
    );
  }

  async function resume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    try {
      const hash = parseMemorySealTransactionHash(recoveryHash.trim());
      await resumeMemorySealFinalization(
        hash,
        createMemorySealFinalizationTracker(),
        setState,
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    }
  }

  function selectAction(next: MemorySealWriteAction) {
    if (busy) return;
    setAction(next);
    setValues({});
    setFormError("");
    setState(session ? { phase: "ready" } : INITIAL_MEMORYSEAL_TRANSACTION_STATE);
  }

  return (
    <section className={`workspace-panel ${styles.panel}`}>
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">Transaction surface</p>
          <h2>Bound writes with explicit finality.</h2>
          <p>
            The browser wallet can submit only the ten frozen MemorySeal write
            methods. A consensus decision is shown as provisional; durable
            success requires finalization plus successful execution.
          </p>
        </div>

        <div className={styles.wallet}>
          {session ? (
            <>
              <code>{shortenHex(session.address, 10, 8)}</code>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => void connect()}
                disabled={busy}
              >
                Reconnect / verify Bradbury
              </button>
            </>
          ) : (
            <button
              className="button button--primary"
              type="button"
              onClick={() => void connect()}
              disabled={busy}
            >
              Connect wallet
            </button>
          )}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.actions} aria-label="MemorySeal write methods">
          {MEMORYSEAL_WRITE_ACTIONS.map((candidate) => (
            <button
              className={`${styles.action} ${
                candidate === action ? styles.actionActive : ""
              }`}
              key={candidate}
              type="button"
              onClick={() => selectAction(candidate)}
              disabled={busy}
            >
              <span>{MEMORYSEAL_WRITE_FORMS[candidate].label}</span>
              <code>{candidate}</code>
            </button>
          ))}
        </div>

        <div className={styles.formPane}>
          <div className={styles.formIntro}>
            <strong>{form.label}</strong>
            <p>{form.description}</p>
          </div>

          <form onSubmit={(event) => void submit(event)}>
            <div className={styles.fields}>
              {form.fields.map((field) => {
                const wide = field.kind === "textarea";
                return (
                  <div
                    className={`${styles.field} ${
                      wide ? styles.fieldWide : ""
                    }`}
                    key={field.name}
                  >
                    <label htmlFor={`memoryseal-write-${field.name}`}>
                      {field.label}
                      {field.optional ? " · optional" : ""}
                    </label>

                    {field.kind === "textarea" ? (
                      <textarea
                        id={`memoryseal-write-${field.name}`}
                        value={values[field.name] ?? ""}
                        placeholder={field.placeholder}
                        disabled={busy}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <input
                        id={`memoryseal-write-${field.name}`}
                        inputMode={field.kind === "integer" ? "numeric" : undefined}
                        value={values[field.name] ?? ""}
                        placeholder={field.placeholder}
                        disabled={busy}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className={styles.formActions}>
              <button
                className="button button--primary"
                type="submit"
                disabled={busy || !session || hasRecordedPendingTransaction}
              >
                Review in wallet
              </button>
            </div>
          </form>

          {formError ? <p className={styles.error}>{formError}</p> : null}

          {hasRecordedPendingTransaction ? (
            <p className={styles.warning}>
              A recorded transaction is still pending. New write submission is
              locked until you resume finalization by the recorded hash below.
            </p>
          ) : null}

          <div className={styles.status} aria-live="polite">
            <div className={styles.statusTop}>
              <div>
                <span>Transaction state</span>
                <strong>{transactionStateLabel(state)}</strong>
              </div>
              {state.txHash ? (
                <code>{shortenHex(state.txHash, 14, 10)}</code>
              ) : null}
            </div>

            {(state.decision || state.finalization) ? (
              <div className={styles.statusGrid}>
                {state.decision ? (
                  <div>
                    <span>Decision</span>
                    <strong>
                      {state.decision.statusName ?? "Unknown"} /{" "}
                      {state.decision.txExecutionResultName ?? "Unknown"}
                    </strong>
                  </div>
                ) : null}
                {state.finalization ? (
                  <div>
                    <span>Finalization</span>
                    <strong>
                      {state.finalization.statusName ?? "Unknown"} /{" "}
                      {state.finalization.txExecutionResultName ?? "Unknown"}
                    </strong>
                  </div>
                ) : null}
              </div>
            ) : null}

            {state.phase === "decision_observed" ||
            state.phase === "waiting_finalization" ? (
              <p className={styles.warning}>
                Decision observed. This is not durable completion yet.
                MemorySeal waits for finalization before reporting success.
              </p>
            ) : null}

            {state.phase === "ambiguous_after_submission" ? (
              <p className={styles.warning}>
                A transaction hash already exists. Do not submit the same
                action again. Resume tracking by that hash below.
              </p>
            ) : null}

            {state.error ? (
              <p className={styles.error}>{state.error}</p>
            ) : null}
          </div>

          <form className={styles.recovery} onSubmit={(event) => void resume(event)}>
            <strong>Resume an existing transaction</strong>
            <p>
              Use the recorded GenLayer transaction hash after a page reload or
              ambiguous RPC interruption. If this browser recorded a submitted
              transaction, its hash is restored here automatically. This tracker
              never resubmits the underlying write.
            </p>
            <div className={styles.recoveryControl}>
              <input
                value={recoveryHash}
                onChange={(event) => setRecoveryHash(event.target.value)}
                placeholder="0x… transaction hash"
                spellCheck={false}
                disabled={busy}
              />
              <button
                className="button button--quiet"
                type="submit"
                disabled={busy}
              >
                Resume finalization
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
