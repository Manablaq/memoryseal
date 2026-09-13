import { describe, expect, it } from "vitest";

import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";
import {
  buildMemorySealWriteIntent,
  MEMORYSEAL_WRITE_ACTIONS,
  type MemorySealWriteAction,
} from "./write-form";

const ADDRESS = "0x1111111111111111111111111111111111111111";

const samples: Record<MemorySealWriteAction, Record<string, string>> = {
  create_policy: {
    slug: "claims",
    version: "1",
    minEvidenceRecords: "2",
    minDistinctIssuers: "2",
    minDistinctOrigins: "2",
    maxEvidenceAgeSeconds: "3600",
    minRemainingValiditySeconds: "300",
    maxClaimLifetimeSeconds: "7200",
    maxEvidenceRecords: "8",
    maxContentBytes: "4096",
  },
  add_policy_issuer: {
    policyId: "policy-1",
    issuerAddress: ADDRESS,
  },
  add_policy_origin: {
    policyId: "policy-1",
    origin: "https://issuer.example",
  },
  seal_policy: {
    policyId: "policy-1",
  },
  register_evidence: {
    policyId: "policy-1",
    stableRecordId: "record-1",
    version: "1",
    sourceUrl: "https://issuer.example/records/1",
    publisherOrigin: "https://issuer.example",
    sha256Digest: "a".repeat(64),
    issuedAt: "1000",
    expiresAt: "2000",
  },
  propose_claim: {
    subjectId: "subject-1",
    claimText: "The signed evidence supports this claim.",
    policyId: "policy-1",
    evidenceIds: "evidence-1,evidence-2",
    supersedesClaimId: "",
  },
  propose_repair_claim: {
    parentClaimId: "claim-1",
    evidenceIds: "evidence-3",
  },
  cancel_claim: {
    claimId: "claim-1",
  },
  expire_claim: {
    claimId: "claim-1",
  },
  review_claim: {
    claimId: "claim-1",
  },
};

describe("MemorySeal write form allowlist", () => {
  it("contains exactly the frozen 10 write methods", () => {
    expect(MEMORYSEAL_WRITE_ACTIONS).toEqual([
      "create_policy",
      "add_policy_issuer",
      "add_policy_origin",
      "seal_policy",
      "register_evidence",
      "propose_claim",
      "propose_repair_claim",
      "cancel_claim",
      "expire_claim",
      "review_claim",
    ]);
  });

  it("builds only frozen Main or Registry zero-value intents", () => {
    for (const action of MEMORYSEAL_WRITE_ACTIONS) {
      const intent = buildMemorySealWriteIntent(action, samples[action]);
      expect(intent.functionName).toBe(action);
      expect([
        MEMORYSEAL_DEPLOYMENT.contracts.main,
        MEMORYSEAL_DEPLOYMENT.contracts.registry,
      ]).toContain(intent.address);
      expect(intent.value).toBe(BigInt(0));
    }
  });

  it("rejects invalid issuer addresses before an intent exists", () => {
    expect(() =>
      buildMemorySealWriteIntent("add_policy_issuer", {
        policyId: "policy-1",
        issuerAddress: "not-an-address",
      }),
    ).toThrow(/20-byte/);
  });

  it("rejects non-HTTPS evidence URLs before an intent exists", () => {
    expect(() =>
      buildMemorySealWriteIntent("register_evidence", {
        ...samples.register_evidence,
        sourceUrl: "http://issuer.example/records/1",
      }),
    ).toThrow(/HTTPS/);
  });
});
