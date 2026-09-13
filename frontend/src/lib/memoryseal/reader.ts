import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";

import {
  decodeAddress,
  decodeBigInt,
  decodeBoolean,
  decodeClaimRecord,
  decodeEvidenceRecord,
  decodeEvidenceWire,
  decodePolicyWire,
  decodeRegistryPolicy,
  decodeString,
} from "./decoders";
import type { MemorySealReadMethod } from "./surface";
import type {
  AddressHex,
  ClaimRecord,
  EvidenceRecord,
  EvidenceWire,
  MemorySealValue,
  PolicyWire,
  RegistryPolicy,
} from "./types";

export interface MemorySealReadRequest {
  address: AddressHex;
  functionName: MemorySealReadMethod;
  args: readonly MemorySealValue[];
}

export interface MemorySealReadTransport {
  readContract(request: MemorySealReadRequest): Promise<unknown>;
}

const MAIN = MEMORYSEAL_DEPLOYMENT.contracts.main as AddressHex;
const REGISTRY = MEMORYSEAL_DEPLOYMENT.contracts.registry as AddressHex;

export class MemorySealReader {
  constructor(private readonly transport: MemorySealReadTransport) {}

  private read(
    address: AddressHex,
    functionName: MemorySealReadMethod,
    args: readonly MemorySealValue[],
  ): Promise<unknown> {
    return this.transport.readContract({ address, functionName, args });
  }

  async getOwner(): Promise<AddressHex> {
    return decodeAddress(await this.read(REGISTRY, "get_owner", []), "registry owner");
  }

  async getPolicyCount(): Promise<bigint> {
    return decodeBigInt(await this.read(REGISTRY, "get_policy_count", []), "policy count");
  }

  async getEvidenceCount(): Promise<bigint> {
    return decodeBigInt(
      await this.read(REGISTRY, "get_evidence_count", []),
      "evidence count",
    );
  }

  async derivePolicyId(
    ownerAddress: AddressHex,
    slug: string,
    version: bigint,
  ): Promise<string> {
    return decodeString(
      await this.read(REGISTRY, "derive_policy_id", [ownerAddress, slug, version]),
      "policy id",
    );
  }

  async getPolicy(policyId: string): Promise<RegistryPolicy> {
    return decodeRegistryPolicy(
      await this.read(REGISTRY, "get_policy", [policyId]),
    );
  }

  async isPolicyIssuer(
    policyId: string,
    issuerAddress: AddressHex,
  ): Promise<boolean> {
    return decodeBoolean(
      await this.read(REGISTRY, "is_policy_issuer", [policyId, issuerAddress]),
      "policy issuer membership",
    );
  }

  async isPolicyOrigin(policyId: string, origin: string): Promise<boolean> {
    return decodeBoolean(
      await this.read(REGISTRY, "is_policy_origin", [policyId, origin]),
      "policy origin membership",
    );
  }

  async deriveEvidenceId(
    policyId: string,
    stableRecordId: string,
    version: bigint,
  ): Promise<string> {
    return decodeString(
      await this.read(REGISTRY, "derive_evidence_id", [
        policyId,
        stableRecordId,
        version,
      ]),
      "evidence id",
    );
  }

  async getEvidence(evidenceId: string): Promise<EvidenceRecord> {
    return decodeEvidenceRecord(
      await this.read(REGISTRY, "get_evidence", [evidenceId]),
    );
  }

  async getLatestEvidenceVersion(
    policyId: string,
    stableRecordId: string,
  ): Promise<bigint> {
    return decodeBigInt(
      await this.read(REGISTRY, "get_latest_evidence_version", [
        policyId,
        stableRecordId,
      ]),
      "latest evidence version",
    );
  }

  async getPolicyWire(policyId: string): Promise<PolicyWire | null> {
    return decodePolicyWire(
      await this.read(REGISTRY, "get_policy_wire", [policyId]),
    );
  }

  async getEvidenceWire(evidenceId: string): Promise<EvidenceWire | null> {
    return decodeEvidenceWire(
      await this.read(REGISTRY, "get_evidence_wire", [evidenceId]),
    );
  }

  async getRegistry(): Promise<AddressHex> {
    return decodeAddress(await this.read(MAIN, "get_registry", []), "main registry");
  }

  async getClaimCount(): Promise<bigint> {
    return decodeBigInt(await this.read(MAIN, "get_claim_count", []), "claim count");
  }

  async getClaim(claimId: string): Promise<ClaimRecord> {
    return decodeClaimRecord(await this.read(MAIN, "get_claim", [claimId]));
  }

  async getClaimEvidenceId(claimId: string, index: bigint): Promise<string> {
    return decodeString(
      await this.read(MAIN, "get_claim_evidence_id", [claimId, index]),
      "claim evidence id",
    );
  }

  async getRecordedSubjectHead(subjectId: string): Promise<string> {
    return decodeString(
      await this.read(MAIN, "get_recorded_subject_head", [subjectId]),
      "recorded subject head",
    );
  }

  async getSubjectHead(subjectId: string): Promise<string> {
    return decodeString(
      await this.read(MAIN, "get_subject_head", [subjectId]),
      "effective subject head",
    );
  }

  async getSubjectHistoryCount(subjectId: string): Promise<bigint> {
    return decodeBigInt(
      await this.read(MAIN, "get_subject_history_count", [subjectId]),
      "subject history count",
    );
  }

  async getSubjectHistoryClaimId(
    subjectId: string,
    index: bigint,
  ): Promise<string> {
    return decodeString(
      await this.read(MAIN, "get_subject_history_claim_id", [subjectId, index]),
      "subject history claim id",
    );
  }
}
