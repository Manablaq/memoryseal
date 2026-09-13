import { describe, expect, it } from "vitest";

import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";

import {
  MEMORYSEAL_WRITE_POLICY,
  MemorySealWriteIntents,
} from "./write-intents";

const ISSUER = "0x1111111111111111111111111111111111111111" as const;

describe("MemorySeal pure write intents", () => {
  const writes = new MemorySealWriteIntents();

  it("builds Registry policy writes against only the frozen Registry", () => {
    const create = writes.createPolicy({
      slug: "news",
      version: BigInt(1),
      minEvidenceRecords: BigInt(2),
      minDistinctIssuers: BigInt(2),
      minDistinctOrigins: BigInt(2),
      maxEvidenceAgeSeconds: BigInt(3600),
      minRemainingValiditySeconds: BigInt(60),
      maxClaimLifetimeSeconds: BigInt(7200),
      maxEvidenceRecords: BigInt(4),
      maxContentBytes: BigInt(4096),
    });
    const issuer = writes.addPolicyIssuer("policy-1", ISSUER);

    expect(create.address).toBe(MEMORYSEAL_DEPLOYMENT.contracts.registry);
    expect(create.functionName).toBe("create_policy");
    expect(create.value).toBe(BigInt(0));
    expect(issuer.functionName).toBe("add_policy_issuer");
  });

  it("builds claim writes against only the frozen Main", () => {
    const propose = writes.proposeClaim({
      subjectId: "subject-a",
      claimText: "A canonical claim",
      policyId: "policy-1",
      evidenceIds: ["evidence-a", "evidence-b"],
      supersedesClaimId: "",
    });
    const review = writes.reviewClaim("claim-1");

    expect(propose.address).toBe(MEMORYSEAL_DEPLOYMENT.contracts.main);
    expect(propose.functionName).toBe("propose_claim");
    expect(review.functionName).toBe("review_claim");
  });

  it("does not implement submission, auto-retry, or replacement in 4E", () => {
    expect(MEMORYSEAL_WRITE_POLICY.walletSubmissionImplementedInThisModule).toBe(
      false,
    );
    expect(MEMORYSEAL_WRITE_POLICY.automaticRetryAllowed).toBe(false);
    expect(MEMORYSEAL_WRITE_POLICY.automaticReplacementAllowed).toBe(false);
    expect(MEMORYSEAL_WRITE_POLICY.arbitraryContractAddressAllowed).toBe(false);
    expect(MEMORYSEAL_WRITE_POLICY.arbitraryMethodAllowed).toBe(false);
  });
});
