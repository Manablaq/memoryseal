"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";

import { MEMORYSEAL_DEPLOYMENT } from "../config/memoryseal";
import {
  formatInteger,
  serializeForDisplay,
  shortenHex,
  useMemorySealReader,
  useProtocolOverview,
} from "../lib/memoryseal/ui-hooks";
import {
  ArrowIcon,
  Brand,
  ExternalIcon,
  RefreshIcon,
  SearchIcon,
} from "./brand";
import { TransactionPanel } from "./transaction-panel";

type InspectMode = "policy" | "evidence" | "claim" | "subject";

const inspectModes: Array<{
  id: InspectMode;
  label: string;
  placeholder: string;
}> = [
  { id: "policy", label: "Policy", placeholder: "Policy ID" },
  { id: "evidence", label: "Evidence", placeholder: "Evidence ID" },
  { id: "claim", label: "Claim", placeholder: "Claim ID" },
  { id: "subject", label: "Subject", placeholder: "Subject ID" },
];


function LiveMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyInspector() {
  return (
    <div className="inspector-empty">
      <div className="inspector-empty__mark">
        <SearchIcon />
      </div>
      <h3>Direct identifier inspection</h3>
      <p>
        MemorySeal does not invent global lists from count-only reads. Enter a
        known identifier to inspect finalized protocol state.
      </p>
    </div>
  );
}

export function ProtocolWorkspace() {
  const overview = useProtocolOverview();
  const reader = useMemorySealReader();
  const [mode, setMode] = useState<InspectMode>("policy");
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState("");

  const inspection = useQuery({
    queryKey: ["memoryseal", "inspect", mode, target, "latest-final"],
    enabled: target.length > 0,
    retry: false,
    queryFn: async () => {
      if (mode === "policy") {
        const value = await reader.getPolicyWire(target);
        return {
          kind: "Policy",
          identifier: target,
          value,
          note:
            value === null
              ? "No finalized policy exists for this ID."
              : "Finalized policy wire: owner, slug, version, trust thresholds and fingerprint.",
        };
      }

      if (mode === "evidence") {
        const value = await reader.getEvidenceWire(target);
        return {
          kind: "Evidence",
          identifier: target,
          value,
          note:
            value === null
              ? "No finalized evidence exists for this ID."
              : "Finalized evidence wire with stable lineage, provenance, digest, freshness and latest version.",
        };
      }

      if (mode === "claim") {
        const value = await reader.getClaim(target);
        return {
          kind: "Claim",
          identifier: target,
          value,
          note: "Finalized claim state and consequence-bearing review metadata.",
        };
      }

      const [recordedHead, effectiveHead, historyCount] = await Promise.all([
        reader.getRecordedSubjectHead(target),
        reader.getSubjectHead(target),
        reader.getSubjectHistoryCount(target),
      ]);
      const latestHistoryClaim =
        historyCount > BigInt(0)
          ? await reader.getSubjectHistoryClaimId(
              target,
              historyCount - BigInt(1),
            )
          : "";

      return {
        kind: "Subject",
        identifier: target,
        value: {
          recordedHead,
          effectiveHead,
          historyCount,
          latestHistoryClaim,
        },
        note:
          "Recorded head and currently effective head are shown separately so expiry never rewrites history.",
      };
    },
  });

  const currentMode =
    inspectModes.find((candidate) => candidate.id === mode) ?? inspectModes[0];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (value) setTarget(value);
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <Brand />
        <div className="workspace-topbar__center">
          <span className={overview.isError ? "status-dot status-dot--error" : "status-dot"} />
          <span>Bradbury</span>
          <span className="workspace-topbar__divider" />
          <span>LATEST_FINAL</span>
        </div>
        <div className="workspace-topbar__actions">
          <Link className="button button--quiet" href="/">
            Overview
          </Link>
          <a
            className="icon-button"
            href={`${MEMORYSEAL_DEPLOYMENT.network.explorerUrl}/addresses/${MEMORYSEAL_DEPLOYMENT.contracts.main}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open Main contract in explorer"
          >
            <ExternalIcon />
          </a>
        </div>
      </header>

      <section className="workspace-hero">
        <div>
          <p className="eyebrow eyebrow--accent">Protocol workspace</p>
          <h1>Finalized memory, inspected at the source.</h1>
          <p>
            Every value below is either read from the frozen Bradbury
            deployment or explicitly marked unavailable. There is no
            fabricated protocol state.
          </p>
        </div>

        <div className="network-card">
          <div className="network-card__row">
            <span>Network</span>
            <strong>Bradbury · 4221</strong>
          </div>
          <div className="network-card__row">
            <span>Main</span>
            <code>{shortenHex(MEMORYSEAL_DEPLOYMENT.contracts.main)}</code>
          </div>
          <div className="network-card__row">
            <span>Registry</span>
            <code>{shortenHex(MEMORYSEAL_DEPLOYMENT.contracts.registry)}</code>
          </div>
          <div className="network-card__footer">
            <span className="status-dot" />
            Frozen deployment
          </div>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Finalized protocol counts">
        <LiveMetric
          label="Policies"
          value={
            overview.isError ? "Unavailable" : formatInteger(overview.data?.policyCount)
          }
          detail="Registry policy count"
        />
        <LiveMetric
          label="Evidence records"
          value={
            overview.isError ? "Unavailable" : formatInteger(overview.data?.evidenceCount)
          }
          detail="Versioned evidence count"
        />
        <LiveMetric
          label="Claims"
          value={
            overview.isError ? "Unavailable" : formatInteger(overview.data?.claimCount)
          }
          detail="Main claim count"
        />
        <div className="metric-card metric-card--binding">
          <span>Main → Registry</span>
          <strong>
            {overview.isError
              ? "Unavailable"
              : overview.data
                ? overview.data.registry.toLowerCase() ===
                  MEMORYSEAL_DEPLOYMENT.contracts.registry.toLowerCase()
                  ? "Bound"
                  : "Mismatch"
                : "—"}
          </strong>
          <small>Live finalized binding check</small>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="workspace-panel workspace-panel--inspector">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Finalized inspector</p>
              <h2>Read protocol objects directly.</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Refresh live protocol overview"
              onClick={() => void overview.refetch()}
            >
              <RefreshIcon />
            </button>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Inspection type">
            {inspectModes.map((candidate) => (
              <button
                className={mode === candidate.id ? "mode-tab mode-tab--active" : "mode-tab"}
                key={candidate.id}
                type="button"
                role="tab"
                aria-selected={mode === candidate.id}
                onClick={() => {
                  setMode(candidate.id);
                  setTarget("");
                  setDraft("");
                }}
              >
                {candidate.label}
              </button>
            ))}
          </div>

          <form className="inspect-form" onSubmit={submit}>
            <label htmlFor="memoryseal-identifier">
              {currentMode.label} identifier
            </label>
            <div className="inspect-form__control">
              <input
                id="memoryseal-identifier"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={currentMode.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="button button--primary" type="submit">
                Inspect <SearchIcon />
              </button>
            </div>
          </form>

          <div className="inspect-result" aria-live="polite">
            {!target ? (
              <EmptyInspector />
            ) : inspection.isLoading ? (
              <div className="inspector-empty">
                <span className="loading-ring" />
                <h3>Reading finalized state</h3>
                <p>Querying the frozen Bradbury deployment.</p>
              </div>
            ) : inspection.isError ? (
              <div className="inspector-error">
                <span>Read failed</span>
                <h3>Finalized object unavailable.</h3>
                <p>
                  {inspection.error instanceof Error
                    ? inspection.error.message
                    : "The finalized read returned an error."}
                </p>
              </div>
            ) : inspection.data ? (
              <motion.div
                className="result-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="result-card__header">
                  <div>
                    <span>{inspection.data.kind}</span>
                    <code>{shortenHex(inspection.data.identifier, 14, 10)}</code>
                  </div>
                  <span className="final-badge">FINAL</span>
                </div>
                <p>{inspection.data.note}</p>
                <pre>{serializeForDisplay(inspection.data.value)}</pre>
              </motion.div>
            ) : null}
          </div>
        </div>

        <aside className="workspace-panel workspace-panel--rail">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">State model</p>
              <h2>Meaning stays distinct.</h2>
            </div>
          </div>

          <div className="state-list">
            {[
              ["REVIEWABLE", "Awaiting exact review consequence."],
              ["SUPPORTED", "Canonical support established."],
              ["REJECTED", "Review concluded against the claim."],
              ["REPAIR_REQUIRED", "Evidence can be corrected."],
              ["SUPERSEDED", "A newer canonical claim replaced it."],
              ["CANCELED", "Proposer canceled before conclusion."],
              ["EXPIRED", "The review/liveness window elapsed."],
            ].map(([state, copy]) => (
              <div className="state-row" key={state}>
                <span className={`state-signal state-signal--${state.toLowerCase()}`} />
                <div>
                  <strong>{state}</strong>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <TransactionPanel />

      <footer className="workspace-footer">
        <span>MemorySeal · finalized Bradbury state</span>
        <Link href="/">
          Protocol overview <ArrowIcon />
        </Link>
      </footer>
    </main>
  );
}
