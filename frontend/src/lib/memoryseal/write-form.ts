import type { MemorySealWriteIntent } from "./write-intents";
import { MemorySealWriteIntents } from "./write-intents";
import type { AddressHex } from "./types";

export const MEMORYSEAL_WRITE_ACTIONS = [
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
] as const;

export type MemorySealWriteAction =
  (typeof MEMORYSEAL_WRITE_ACTIONS)[number];

export interface MemorySealWriteField {
  name: string;
  label: string;
  kind: "text" | "integer" | "textarea";
  placeholder?: string;
  optional?: boolean;
}

export const MEMORYSEAL_WRITE_FORMS: Record<
  MemorySealWriteAction,
  {
    label: string;
    description: string;
    fields: readonly MemorySealWriteField[];
  }
> = {
  create_policy: {
    label: "Create policy",
    description: "Create a new trust-policy draft before approving issuers and origins.",
    fields: [
      { name: "slug", label: "Slug", kind: "text" },
      { name: "version", label: "Version", kind: "integer" },
      { name: "minEvidenceRecords", label: "Minimum evidence records", kind: "integer" },
      { name: "minDistinctIssuers", label: "Minimum distinct issuers", kind: "integer" },
      { name: "minDistinctOrigins", label: "Minimum distinct origins", kind: "integer" },
      { name: "maxEvidenceAgeSeconds", label: "Maximum evidence age (seconds)", kind: "integer" },
      { name: "minRemainingValiditySeconds", label: "Minimum remaining validity (seconds)", kind: "integer" },
      { name: "maxClaimLifetimeSeconds", label: "Maximum claim lifetime (seconds)", kind: "integer" },
      { name: "maxEvidenceRecords", label: "Maximum evidence records", kind: "integer" },
      { name: "maxContentBytes", label: "Maximum claim content bytes", kind: "integer" },
    ],
  },
  add_policy_issuer: {
    label: "Approve issuer",
    description: "Add one approved evidence issuer to an unsealed policy.",
    fields: [
      { name: "policyId", label: "Policy ID", kind: "text" },
      { name: "issuerAddress", label: "Issuer address", kind: "text" },
    ],
  },
  add_policy_origin: {
    label: "Approve origin",
    description: "Add one approved publisher origin to an unsealed policy.",
    fields: [
      { name: "policyId", label: "Policy ID", kind: "text" },
      { name: "origin", label: "HTTPS origin", kind: "text", placeholder: "https://example.com" },
    ],
  },
  seal_policy: {
    label: "Seal policy",
    description: "Freeze the policy trust model and fingerprint.",
    fields: [{ name: "policyId", label: "Policy ID", kind: "text" }],
  },
  register_evidence: {
    label: "Register evidence",
    description: "Register a versioned evidence record under a sealed policy.",
    fields: [
      { name: "policyId", label: "Policy ID", kind: "text" },
      { name: "stableRecordId", label: "Stable record ID", kind: "text" },
      { name: "version", label: "Evidence version", kind: "integer" },
      { name: "sourceUrl", label: "HTTPS source URL", kind: "text" },
      { name: "publisherOrigin", label: "Publisher origin", kind: "text" },
      { name: "sha256Digest", label: "SHA-256 digest", kind: "text" },
      { name: "issuedAt", label: "Issued-at Unix seconds", kind: "integer" },
      { name: "expiresAt", label: "Expires-at Unix seconds", kind: "integer" },
    ],
  },
  propose_claim: {
    label: "Propose claim",
    description: "Propose a subject claim bound to policy-authorized evidence.",
    fields: [
      { name: "subjectId", label: "Subject ID", kind: "text" },
      { name: "claimText", label: "Claim text", kind: "textarea" },
      { name: "policyId", label: "Policy ID", kind: "text" },
      { name: "evidenceIds", label: "Evidence IDs", kind: "textarea", placeholder: "Comma or newline separated" },
      { name: "supersedesClaimId", label: "Supersedes claim ID", kind: "text", optional: true },
    ],
  },
  propose_repair_claim: {
    label: "Propose repair",
    description: "Repair an identified evidence lineage without silently replacing the parent claim.",
    fields: [
      { name: "parentClaimId", label: "Parent claim ID", kind: "text" },
      { name: "evidenceIds", label: "Replacement evidence IDs", kind: "textarea", placeholder: "Comma or newline separated" },
    ],
  },
  cancel_claim: {
    label: "Cancel claim",
    description: "Cancel an eligible claim through the frozen Main contract.",
    fields: [{ name: "claimId", label: "Claim ID", kind: "text" }],
  },
  expire_claim: {
    label: "Expire claim",
    description: "Materialize an eligible claim expiry after its liveness deadline.",
    fields: [{ name: "claimId", label: "Claim ID", kind: "text" }],
  },
  review_claim: {
    label: "Review claim",
    description: "Run the exact consensus-backed review for an eligible claim.",
    fields: [{ name: "claimId", label: "Claim ID", kind: "text" }],
  },
};

const required = (
  values: Readonly<Record<string, string>>,
  name: string,
): string => {
  const value = values[name]?.trim() ?? "";
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const integer = (
  values: Readonly<Record<string, string>>,
  name: string,
): bigint => {
  const value = required(values, name);
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return BigInt(value);
};

const address = (
  values: Readonly<Record<string, string>>,
  name: string,
): AddressHex => {
  const value = required(values, name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte 0x-prefixed address.`);
  }
  return value as AddressHex;
};

const ids = (
  values: Readonly<Record<string, string>>,
  name: string,
): readonly string[] => {
  const parsed = required(values, name)
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    throw new Error(`${name} must contain at least one identifier.`);
  }

  return parsed;
};

const httpsUrl = (
  values: Readonly<Record<string, string>>,
  name: string,
): string => {
  const value = required(values, name);
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }
  return value;
};

const intents = new MemorySealWriteIntents();

export function buildMemorySealWriteIntent(
  action: MemorySealWriteAction,
  values: Readonly<Record<string, string>>,
): MemorySealWriteIntent {
  switch (action) {
    case "create_policy":
      return intents.createPolicy({
        slug: required(values, "slug"),
        version: integer(values, "version"),
        minEvidenceRecords: integer(values, "minEvidenceRecords"),
        minDistinctIssuers: integer(values, "minDistinctIssuers"),
        minDistinctOrigins: integer(values, "minDistinctOrigins"),
        maxEvidenceAgeSeconds: integer(values, "maxEvidenceAgeSeconds"),
        minRemainingValiditySeconds: integer(values, "minRemainingValiditySeconds"),
        maxClaimLifetimeSeconds: integer(values, "maxClaimLifetimeSeconds"),
        maxEvidenceRecords: integer(values, "maxEvidenceRecords"),
        maxContentBytes: integer(values, "maxContentBytes"),
      });

    case "add_policy_issuer":
      return intents.addPolicyIssuer(
        required(values, "policyId"),
        address(values, "issuerAddress"),
      );

    case "add_policy_origin":
      return intents.addPolicyOrigin(
        required(values, "policyId"),
        httpsUrl(values, "origin").replace(/\/$/, ""),
      );

    case "seal_policy":
      return intents.sealPolicy(required(values, "policyId"));

    case "register_evidence":
      return intents.registerEvidence({
        policyId: required(values, "policyId"),
        stableRecordId: required(values, "stableRecordId"),
        version: integer(values, "version"),
        sourceUrl: httpsUrl(values, "sourceUrl"),
        publisherOrigin: httpsUrl(values, "publisherOrigin").replace(/\/$/, ""),
        sha256Digest: required(values, "sha256Digest"),
        issuedAt: integer(values, "issuedAt"),
        expiresAt: integer(values, "expiresAt"),
      });

    case "propose_claim":
      return intents.proposeClaim({
        subjectId: required(values, "subjectId"),
        claimText: required(values, "claimText"),
        policyId: required(values, "policyId"),
        evidenceIds: ids(values, "evidenceIds"),
        supersedesClaimId: values.supersedesClaimId?.trim() ?? "",
      });

    case "propose_repair_claim":
      return intents.proposeRepairClaim({
        parentClaimId: required(values, "parentClaimId"),
        evidenceIds: ids(values, "evidenceIds"),
      });

    case "cancel_claim":
      return intents.cancelClaim(required(values, "claimId"));

    case "expire_claim":
      return intents.expireClaim(required(values, "claimId"));

    case "review_claim":
      return intents.reviewClaim(required(values, "claimId"));
  }
}
