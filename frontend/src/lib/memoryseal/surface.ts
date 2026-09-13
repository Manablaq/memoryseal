export const REGISTRY_VIEW_METHODS = [
  "get_owner",
  "get_policy_count",
  "get_evidence_count",
  "derive_policy_id",
  "get_policy",
  "is_policy_issuer",
  "is_policy_origin",
  "derive_evidence_id",
  "get_evidence",
  "get_latest_evidence_version",
  "get_policy_wire",
  "get_evidence_wire",
] as const;

export const REGISTRY_WRITE_METHODS = [
  "create_policy",
  "add_policy_issuer",
  "add_policy_origin",
  "seal_policy",
  "register_evidence",
] as const;

export const MAIN_VIEW_METHODS = [
  "get_registry",
  "get_claim_count",
  "get_claim",
  "get_claim_evidence_id",
  "get_recorded_subject_head",
  "get_subject_head",
  "get_subject_history_count",
  "get_subject_history_claim_id",
] as const;

export const MAIN_WRITE_METHODS = [
  "propose_claim",
  "propose_repair_claim",
  "cancel_claim",
  "expire_claim",
  "review_claim",
] as const;

export type RegistryViewMethod = (typeof REGISTRY_VIEW_METHODS)[number];
export type RegistryWriteMethod = (typeof REGISTRY_WRITE_METHODS)[number];
export type MainViewMethod = (typeof MAIN_VIEW_METHODS)[number];
export type MainWriteMethod = (typeof MAIN_WRITE_METHODS)[number];

export type MemorySealReadMethod = RegistryViewMethod | MainViewMethod;
export type MemorySealWriteMethod = RegistryWriteMethod | MainWriteMethod;

export const MEMORYSEAL_METHOD_SURFACE = {
  registry: {
    views: REGISTRY_VIEW_METHODS,
    writes: REGISTRY_WRITE_METHODS,
  },
  main: {
    views: MAIN_VIEW_METHODS,
    writes: MAIN_WRITE_METHODS,
  },
  totals: {
    views: 20,
    writes: 10,
    methods: 30,
  },
} as const;

export const CLAIM_STATES = [
  "REVIEWABLE",
  "SUPPORTED",
  "REJECTED",
  "REPAIR_REQUIRED",
  "SUPERSEDED",
  "CANCELED",
  "EXPIRED",
] as const;

export const MEMORYSEAL_DISCOVERY_POLICY = {
  globalListsFromCountsAllowed: false,
  policyDiscovery: "direct-id-or-derived-id-or-local-created-id",
  evidenceDiscovery: "direct-id-or-derived-id-or-local-registered-id",
  claimDiscovery: "direct-id-or-local-returned-id-or-known-subject-history",
} as const;
