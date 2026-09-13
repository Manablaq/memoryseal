"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";

import { MEMORYSEAL_DEPLOYMENT } from "../config/memoryseal";
import {
  formatInteger,
  shortenHex,
  useProtocolOverview,
} from "../lib/memoryseal/ui-hooks";
import { ArrowIcon, Brand, ExternalIcon, SealGlyph } from "./brand";

const states = [
  "REVIEWABLE",
  "SUPPORTED",
  "REJECTED",
  "REPAIR_REQUIRED",
  "SUPERSEDED",
  "CANCELED",
  "EXPIRED",
] as const;

const trustLayers = [
  {
    index: "01",
    title: "Policy-bound trust",
    copy: "Approved issuers, approved HTTPS origins, corroboration thresholds, freshness windows and claim lifetime are sealed into a policy fingerprint.",
  },
  {
    index: "02",
    title: "Versioned evidence",
    copy: "Every evidence record carries a stable record ID, monotonic version, issuer, publisher origin, content digest, issue time and expiry.",
  },
  {
    index: "03",
    title: "Exact claim consequence",
    copy: "Review resolves the actual consequential claim state. Repair remains explicit instead of hiding evidence failure behind a binary outcome.",
  },
  {
    index: "04",
    title: "Canonical memory",
    copy: "Supported claims become subject history and a canonical head, while recorded and currently effective heads remain separately observable.",
  },
] as const;

const flow = [
  ["Seal a policy", "Define who may attest, where evidence may originate, and how fresh it must be."],
  ["Register evidence", "Bind immutable digests to stable identities and strictly increasing evidence versions."],
  ["Propose a claim", "Attach policy-bound evidence to a subject without weakening provenance."],
  ["Review & remember", "Consensus resolves the claim; supported outcomes advance canonical subject memory."],
] as const;

function LiveProtocolStrip() {
  const overview = useProtocolOverview();

  return (
    <section className="live-strip" aria-label="Live Bradbury protocol status">
      <div className="live-strip__lead">
        <span className={overview.isError ? "status-dot status-dot--error" : "status-dot"} />
        <div>
          <p className="eyebrow">Bradbury / latest final</p>
          <strong>
            {overview.isLoading
              ? "Reading finalized state…"
              : overview.isError
                ? "Finalized read unavailable"
                : "Deployment verified live"}
          </strong>
        </div>
      </div>

      <div className="live-strip__metrics">
        <div>
          <span>Policies</span>
          <strong>{formatInteger(overview.data?.policyCount)}</strong>
        </div>
        <div>
          <span>Evidence</span>
          <strong>{formatInteger(overview.data?.evidenceCount)}</strong>
        </div>
        <div>
          <span>Claims</span>
          <strong>{formatInteger(overview.data?.claimCount)}</strong>
        </div>
      </div>

      <Link className="text-link" href="/app">
        Open workspace <ArrowIcon />
      </Link>
    </section>
  );
}

export function LandingPage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.32], [0, 90]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.34], [0.9, 0.12]);

  return (
    <main className="site-shell">
      <motion.div
        className="scroll-progress"
        style={{ scaleX: scrollYProgress }}
        aria-hidden="true"
      />

      <header className="topbar">
        <Brand />
        <nav className="topbar__nav" aria-label="Primary navigation">
          <a href="#protocol">Protocol</a>
          <a href="#trust">Trust model</a>
          <a href="#states">States</a>
        </nav>
        <Link className="button button--quiet" href="/app">
          Enter protocol <ArrowIcon />
        </Link>
      </header>

      <section className="hero">
        <motion.div
          className="hero-orbit"
          style={{ opacity: glowOpacity, y: heroY }}
          aria-hidden="true"
        >
          <div className="hero-orbit__ring hero-orbit__ring--one" />
          <div className="hero-orbit__ring hero-orbit__ring--two" />
          <div className="hero-orbit__core">
            <SealGlyph />
          </div>
        </motion.div>

        <div className="hero__copy">
          <motion.p
            className="eyebrow eyebrow--accent"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            Evidence-bound canonical memory
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.06 }}
          >
            Claims should not become
            <span> memory by accident.</span>
          </motion.h1>
          <motion.p
            className="hero__lede"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.12 }}
          >
            MemorySeal binds evidence authority, provenance, freshness,
            corroboration and exact consensus outcomes before a claim can
            advance canonical subject history.
          </motion.p>

          <motion.div
            className="hero__actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.18 }}
          >
            <Link className="button button--primary" href="/app">
              Inspect live memory <ArrowIcon />
            </Link>
            <a
              className="button button--ghost"
              href={`${MEMORYSEAL_DEPLOYMENT.network.explorerUrl}/addresses/${MEMORYSEAL_DEPLOYMENT.contracts.main}`}
              target="_blank"
              rel="noreferrer"
            >
              Main contract <ExternalIcon />
            </a>
          </motion.div>
        </div>

        <div className="hero__proof">
          <div className="proof-card">
            <div className="proof-card__header">
              <span>Finalized deployment</span>
              <span className="proof-card__badge">BOUND</span>
            </div>
            <div className="proof-card__line">
              <span>Main</span>
              <code>{shortenHex(MEMORYSEAL_DEPLOYMENT.contracts.main)}</code>
            </div>
            <div className="proof-card__line">
              <span>Registry</span>
              <code>{shortenHex(MEMORYSEAL_DEPLOYMENT.contracts.registry)}</code>
            </div>
            <div className="proof-card__line">
              <span>Read policy</span>
              <strong>LATEST_FINAL</strong>
            </div>
            <div className="proof-card__seal">
              <span />
              <p>
                Canonical reads never depend on provisional Accepted state.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LiveProtocolStrip />

      <section className="section section--split" id="protocol">
        <motion.div
          className="section-heading"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <p className="eyebrow">The protocol</p>
          <h2>A memory pipeline with explicit consequence boundaries.</h2>
        </motion.div>

        <div className="flow">
          {flow.map(([title, copy], index) => (
            <motion.article
              className="flow-step"
              key={title}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ delay: index * 0.06 }}
            >
              <span className="flow-step__number">0{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="section" id="trust">
        <div className="section-heading section-heading--wide">
          <p className="eyebrow">Trust model</p>
          <h2>
            URL integrity alone is not authority.
            <span> MemorySeal binds both.</span>
          </h2>
        </div>

        <div className="trust-grid">
          {trustLayers.map((layer, index) => (
            <motion.article
              className="trust-card"
              key={layer.index}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.07 }}
            >
              <span className="trust-card__index">{layer.index}</span>
              <h3>{layer.title}</h3>
              <p>{layer.copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="section state-section" id="states">
        <div className="section-heading">
          <p className="eyebrow">State is meaning</p>
          <h2>Seven outcomes. No collapsed semantics.</h2>
          <p className="section-heading__copy">
            Repairable evidence failure is not rejection. Supersession is not
            cancellation. Expiry is not an adverse review. The UI keeps every
            protocol state distinct.
          </p>
        </div>

        <div className="state-constellation" aria-label="MemorySeal claim states">
          {states.map((state, index) => (
            <motion.span
              className={`state-pill state-pill--${index + 1}`}
              key={state}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.045 }}
            >
              {state}
            </motion.span>
          ))}
        </div>
      </section>

      <section className="section final-cta">
        <div>
          <p className="eyebrow eyebrow--accent">Inspect, don’t assume</p>
          <h2>Read the protocol exactly as finalized.</h2>
          <p>
            Search known policy, evidence, claim and subject identifiers
            directly against the frozen Bradbury deployment.
          </p>
        </div>
        <Link className="button button--primary" href="/app">
          Open MemorySeal workspace <ArrowIcon />
        </Link>
      </section>

      <footer className="footer">
        <Brand />
        <p>Evidence-bound memory on GenLayer Bradbury.</p>
        <span>Chain 4221 · finalized reads</span>
      </footer>
    </main>
  );
}
