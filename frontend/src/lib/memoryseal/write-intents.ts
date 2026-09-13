import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";

import type { MemorySealWriteMethod } from "./surface";
import type {
  AddressHex,
  CreatePolicyInput,
  MemorySealValue,
  ProposeClaimInput,
  ProposeRepairClaimInput,
  RegisterEvidenceInput,
} from "./types";

export interface MemorySealWriteIntent<
  Method extends MemorySealWriteMethod = MemorySealWriteMethod,
> {
  address: AddressHex;
  functionName: Method;
  args: readonly MemorySealValue[];
  value: bigint;
}

const MAIN = MEMORYSEAL_DEPLOYMENT.contracts.main as AddressHex;
const REGISTRY = MEMORYSEAL_DEPLOYMENT.contracts.registry as AddressHex;

const intent = <Method extends MemorySealWriteMethod>(
  address: AddressHex,
  functionName: Method,
  args: readonly MemorySealValue[],
): MemorySealWriteIntent<Method> => ({
  address,
  functionName,
  args,
  value: BigInt(0),
});

export class MemorySealWriteIntents {
  createPolicy(input: CreatePolicyInput) {
    return intent(REGISTRY, "create_policy", [
      input.slug,
      input.version,
      input.minEvidenceRecords,
      input.minDistinctIssuers,
      input.minDistinctOrigins,
      input.maxEvidenceAgeSeconds,
      input.minRemainingValiditySeconds,
      input.maxClaimLifetimeSeconds,
      input.maxEvidenceRecords,
      input.maxContentBytes,
    ]);
  }

  addPolicyIssuer(policyId: string, issuerAddress: AddressHex) {
    return intent(REGISTRY, "add_policy_issuer", [policyId, issuerAddress]);
  }

  addPolicyOrigin(policyId: string, origin: string) {
    return intent(REGISTRY, "add_policy_origin", [policyId, origin]);
  }

  sealPolicy(policyId: string) {
    return intent(REGISTRY, "seal_policy", [policyId]);
  }

  registerEvidence(input: RegisterEvidenceInput) {
    return intent(REGISTRY, "register_evidence", [
      input.policyId,
      input.stableRecordId,
      input.version,
      input.sourceUrl,
      input.publisherOrigin,
      input.sha256Digest,
      input.issuedAt,
      input.expiresAt,
    ]);
  }

  proposeClaim(input: ProposeClaimInput) {
    return intent(MAIN, "propose_claim", [
      input.subjectId,
      input.claimText,
      input.policyId,
      input.evidenceIds,
      input.supersedesClaimId,
    ]);
  }

  proposeRepairClaim(input: ProposeRepairClaimInput) {
    return intent(MAIN, "propose_repair_claim", [
      input.parentClaimId,
      input.evidenceIds,
    ]);
  }

  cancelClaim(claimId: string) {
    return intent(MAIN, "cancel_claim", [claimId]);
  }

  expireClaim(claimId: string) {
    return intent(MAIN, "expire_claim", [claimId]);
  }

  reviewClaim(claimId: string) {
    return intent(MAIN, "review_claim", [claimId]);
  }
}

export const MEMORYSEAL_WRITE_POLICY = {
  arbitraryContractAddressAllowed: false,
  arbitraryMethodAllowed: false,
  automaticRetryAllowed: false,
  automaticReplacementAllowed: false,
  walletSubmissionImplementedInThisModule: false,
  nextSubmissionStage: "4H",
} as const;
