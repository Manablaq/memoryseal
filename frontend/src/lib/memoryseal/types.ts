export type AddressHex = `0x${string}`;
export type TransactionHash = `0x${string}`;

export type ClaimState =
  | "REVIEWABLE"
  | "SUPPORTED"
  | "REJECTED"
  | "REPAIR_REQUIRED"
  | "SUPERSEDED"
  | "CANCELED"
  | "EXPIRED";

export interface RegistryPolicy {
  policyId: string;
  owner: AddressHex;
  slug: string;
  version: bigint;
  sealed: boolean;
  minEvidenceRecords: bigint;
  minDistinctIssuers: bigint;
  minDistinctOrigins: bigint;
  maxEvidenceAgeSeconds: bigint;
  minRemainingValiditySeconds: bigint;
  maxClaimLifetimeSeconds: bigint;
  maxEvidenceRecords: bigint;
  maxContentBytes: bigint;
  issuerCount: bigint;
  originCount: bigint;
  lastIssuer: string;
  lastOrigin: string;
  baseCommitment: string;
  issuerCommitment: string;
  originCommitment: string;
  fingerprint: string;
  createdAt: bigint;
  sealedAt: bigint;
}

export interface EvidenceRecord {
  evidenceId: string;
  policyId: string;
  stableRecordId: string;
  version: bigint;
  issuer: AddressHex;
  sourceUrl: string;
  publisherOrigin: string;
  sha256Digest: string;
  issuedAt: bigint;
  expiresAt: bigint;
  registeredAt: bigint;
}

export interface ClaimRecord {
  claimId: string;
  sequence: bigint;
  subjectId: string;
  claimText: string;
  claimHash: string;
  policyId: string;
  policyFingerprint: string;
  proposer: AddressHex;
  evidenceCount: bigint;
  sourceSetDigest: string;
  evidenceExpiresAt: bigint;
  supersedesClaimId: string;
  repairsClaimId: string;
  repairChildClaimId: string;
  supersededByClaimId: string;
  state: ClaimState;
  reasonCode: string;
  repairEvidenceId: string;
  createdAt: bigint;
  reviewDeadline: bigint;
  reviewedAt: bigint;
  validUntil: bigint;
  stateChangedAt: bigint;
}

export interface PolicyWire {
  owner: AddressHex;
  slug: string;
  version: bigint;
  sealed: boolean;
  minEvidenceRecords: bigint;
  minDistinctIssuers: bigint;
  minDistinctOrigins: bigint;
  maxEvidenceAgeSeconds: bigint;
  minRemainingValiditySeconds: bigint;
  maxClaimLifetimeSeconds: bigint;
  maxEvidenceRecords: bigint;
  maxContentBytes: bigint;
  fingerprint: string;
}

export interface EvidenceWire {
  policyId: string;
  stableRecordId: string;
  version: bigint;
  issuer: AddressHex;
  sourceUrl: string;
  publisherOrigin: string;
  sha256Digest: string;
  issuedAt: bigint;
  expiresAt: bigint;
  latestVersion: bigint;
}

export type MemorySealValue =
  | string
  | bigint
  | boolean
  | readonly MemorySealValue[];

export interface CreatePolicyInput {
  slug: string;
  version: bigint;
  minEvidenceRecords: bigint;
  minDistinctIssuers: bigint;
  minDistinctOrigins: bigint;
  maxEvidenceAgeSeconds: bigint;
  minRemainingValiditySeconds: bigint;
  maxClaimLifetimeSeconds: bigint;
  maxEvidenceRecords: bigint;
  maxContentBytes: bigint;
}

export interface RegisterEvidenceInput {
  policyId: string;
  stableRecordId: string;
  version: bigint;
  sourceUrl: string;
  publisherOrigin: string;
  sha256Digest: string;
  issuedAt: bigint;
  expiresAt: bigint;
}

export interface ProposeClaimInput {
  subjectId: string;
  claimText: string;
  policyId: string;
  evidenceIds: readonly string[];
  supersedesClaimId: string;
}

export interface ProposeRepairClaimInput {
  parentClaimId: string;
  evidenceIds: readonly string[];
}
