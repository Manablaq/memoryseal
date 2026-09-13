import { CLAIM_STATES } from "./surface";
import type {
  AddressHex,
  ClaimRecord,
  ClaimState,
  EvidenceRecord,
  EvidenceWire,
  PolicyWire,
  RegistryPolicy,
} from "./types";

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries()) as Record<string, unknown>;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new TypeError(`${label} must be a map-like object`);
};

const asArray = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return value;
};

const asString = (value: unknown, label: string): string => {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be a string`);
  }
  return value;
};

const asBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") {
    throw new TypeError(`${label} must be a boolean`);
  }
  return value;
};

const asBigInt = (value: unknown, label: string): bigint => {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) {
    return BigInt(value);
  }
  throw new TypeError(`${label} must be a non-negative integer`);
};

const asAddress = (value: unknown, label: string): AddressHex => {
  const address = asString(value, label);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new TypeError(`${label} must be a 20-byte hex address`);
  }
  return address as AddressHex;
};

const asClaimState = (value: unknown): ClaimState => {
  const state = asString(value, "claim.state");
  if (!(CLAIM_STATES as readonly string[]).includes(state)) {
    throw new TypeError(`unsupported claim state: ${state}`);
  }
  return state as ClaimState;
};

export const decodeRegistryPolicy = (value: unknown): RegistryPolicy => {
  const r = asRecord(value, "registry policy");
  return {
    policyId: asString(r.policy_id, "policy.policy_id"),
    owner: asAddress(r.owner, "policy.owner"),
    slug: asString(r.slug, "policy.slug"),
    version: asBigInt(r.version, "policy.version"),
    sealed: asBoolean(r.sealed, "policy.sealed"),
    minEvidenceRecords: asBigInt(r.min_evidence_records, "policy.min_evidence_records"),
    minDistinctIssuers: asBigInt(r.min_distinct_issuers, "policy.min_distinct_issuers"),
    minDistinctOrigins: asBigInt(r.min_distinct_origins, "policy.min_distinct_origins"),
    maxEvidenceAgeSeconds: asBigInt(r.max_evidence_age_seconds, "policy.max_evidence_age_seconds"),
    minRemainingValiditySeconds: asBigInt(
      r.min_remaining_validity_seconds,
      "policy.min_remaining_validity_seconds",
    ),
    maxClaimLifetimeSeconds: asBigInt(
      r.max_claim_lifetime_seconds,
      "policy.max_claim_lifetime_seconds",
    ),
    maxEvidenceRecords: asBigInt(r.max_evidence_records, "policy.max_evidence_records"),
    maxContentBytes: asBigInt(r.max_content_bytes, "policy.max_content_bytes"),
    issuerCount: asBigInt(r.issuer_count, "policy.issuer_count"),
    originCount: asBigInt(r.origin_count, "policy.origin_count"),
    lastIssuer: asString(r.last_issuer, "policy.last_issuer"),
    lastOrigin: asString(r.last_origin, "policy.last_origin"),
    baseCommitment: asString(r.base_commitment, "policy.base_commitment"),
    issuerCommitment: asString(r.issuer_commitment, "policy.issuer_commitment"),
    originCommitment: asString(r.origin_commitment, "policy.origin_commitment"),
    fingerprint: asString(r.fingerprint, "policy.fingerprint"),
    createdAt: asBigInt(r.created_at, "policy.created_at"),
    sealedAt: asBigInt(r.sealed_at, "policy.sealed_at"),
  };
};

export const decodeEvidenceRecord = (value: unknown): EvidenceRecord => {
  const r = asRecord(value, "evidence record");
  return {
    evidenceId: asString(r.evidence_id, "evidence.evidence_id"),
    policyId: asString(r.policy_id, "evidence.policy_id"),
    stableRecordId: asString(r.stable_record_id, "evidence.stable_record_id"),
    version: asBigInt(r.version, "evidence.version"),
    issuer: asAddress(r.issuer, "evidence.issuer"),
    sourceUrl: asString(r.source_url, "evidence.source_url"),
    publisherOrigin: asString(r.publisher_origin, "evidence.publisher_origin"),
    sha256Digest: asString(r.sha256_digest, "evidence.sha256_digest"),
    issuedAt: asBigInt(r.issued_at, "evidence.issued_at"),
    expiresAt: asBigInt(r.expires_at, "evidence.expires_at"),
    registeredAt: asBigInt(r.registered_at, "evidence.registered_at"),
  };
};

export const decodeClaimRecord = (value: unknown): ClaimRecord => {
  const r = asRecord(value, "claim");
  return {
    claimId: asString(r.claim_id, "claim.claim_id"),
    sequence: asBigInt(r.sequence, "claim.sequence"),
    subjectId: asString(r.subject_id, "claim.subject_id"),
    claimText: asString(r.claim_text, "claim.claim_text"),
    claimHash: asString(r.claim_hash, "claim.claim_hash"),
    policyId: asString(r.policy_id, "claim.policy_id"),
    policyFingerprint: asString(r.policy_fingerprint, "claim.policy_fingerprint"),
    proposer: asAddress(r.proposer, "claim.proposer"),
    evidenceCount: asBigInt(r.evidence_count, "claim.evidence_count"),
    sourceSetDigest: asString(r.source_set_digest, "claim.source_set_digest"),
    evidenceExpiresAt: asBigInt(r.evidence_expires_at, "claim.evidence_expires_at"),
    supersedesClaimId: asString(r.supersedes_claim_id, "claim.supersedes_claim_id"),
    repairsClaimId: asString(r.repairs_claim_id, "claim.repairs_claim_id"),
    repairChildClaimId: asString(r.repair_child_claim_id, "claim.repair_child_claim_id"),
    supersededByClaimId: asString(r.superseded_by_claim_id, "claim.superseded_by_claim_id"),
    state: asClaimState(r.state),
    reasonCode: asString(r.reason_code, "claim.reason_code"),
    repairEvidenceId: asString(r.repair_evidence_id, "claim.repair_evidence_id"),
    createdAt: asBigInt(r.created_at, "claim.created_at"),
    reviewDeadline: asBigInt(r.review_deadline, "claim.review_deadline"),
    reviewedAt: asBigInt(r.reviewed_at, "claim.reviewed_at"),
    validUntil: asBigInt(r.valid_until, "claim.valid_until"),
    stateChangedAt: asBigInt(r.state_changed_at, "claim.state_changed_at"),
  };
};

export const decodePolicyWire = (value: unknown): PolicyWire | null => {
  const a = asArray(value, "policy wire");
  if (a.length === 0) {
    return null;
  }
  if (a.length !== 13) {
    throw new TypeError(`policy wire must contain 13 fields, got ${a.length}`);
  }
  return {
    owner: asAddress(a[0], "policy wire owner"),
    slug: asString(a[1], "policy wire slug"),
    version: asBigInt(a[2], "policy wire version"),
    sealed: asString(a[3], "policy wire sealed") === "1",
    minEvidenceRecords: asBigInt(a[4], "policy wire min evidence"),
    minDistinctIssuers: asBigInt(a[5], "policy wire min issuers"),
    minDistinctOrigins: asBigInt(a[6], "policy wire min origins"),
    maxEvidenceAgeSeconds: asBigInt(a[7], "policy wire max age"),
    minRemainingValiditySeconds: asBigInt(a[8], "policy wire remaining validity"),
    maxClaimLifetimeSeconds: asBigInt(a[9], "policy wire max claim lifetime"),
    maxEvidenceRecords: asBigInt(a[10], "policy wire max evidence records"),
    maxContentBytes: asBigInt(a[11], "policy wire max content bytes"),
    fingerprint: asString(a[12], "policy wire fingerprint"),
  };
};

export const decodeEvidenceWire = (value: unknown): EvidenceWire | null => {
  const a = asArray(value, "evidence wire");
  if (a.length === 0) {
    return null;
  }
  if (a.length !== 10) {
    throw new TypeError(`evidence wire must contain 10 fields, got ${a.length}`);
  }
  return {
    policyId: asString(a[0], "evidence wire policy id"),
    stableRecordId: asString(a[1], "evidence wire stable record id"),
    version: asBigInt(a[2], "evidence wire version"),
    issuer: asAddress(a[3], "evidence wire issuer"),
    sourceUrl: asString(a[4], "evidence wire source url"),
    publisherOrigin: asString(a[5], "evidence wire publisher origin"),
    sha256Digest: asString(a[6], "evidence wire digest"),
    issuedAt: asBigInt(a[7], "evidence wire issued at"),
    expiresAt: asBigInt(a[8], "evidence wire expires at"),
    latestVersion: asBigInt(a[9], "evidence wire latest version"),
  };
};

export const decodeString = (value: unknown, label: string): string =>
  asString(value, label);

export const decodeAddress = (value: unknown, label: string): AddressHex =>
  asAddress(value, label);

export const decodeBoolean = (value: unknown, label: string): boolean =>
  asBoolean(value, label);

export const decodeBigInt = (value: unknown, label: string): bigint =>
  asBigInt(value, label);
