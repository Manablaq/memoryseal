import { describe, expect, it } from "vitest";

import {
  decodeClaimRecord,
  decodeEvidenceWire,
  decodePolicyWire,
} from "./decoders";

const ADDRESS = "0x1111111111111111111111111111111111111111";

describe("MemorySeal calldata decoders", () => {
  it("decodes policy wire values without losing integer precision", () => {
    const decoded = decodePolicyWire([
      ADDRESS,
      "news",
      "7",
      "1",
      "2",
      "2",
      "2",
      "3600",
      "60",
      "7200",
      "8",
      "4096",
      "fingerprint",
    ]);

    expect(decoded?.version).toBe(BigInt(7));
    expect(decoded?.sealed).toBe(true);
    expect(decoded?.maxContentBytes).toBe(BigInt(4096));
  });

  it("treats an empty policy/evidence wire as not found", () => {
    expect(decodePolicyWire([])).toBeNull();
    expect(decodeEvidenceWire([])).toBeNull();
  });

  it("decodes a Map-backed claim and preserves every consequential state field", () => {
    const claim = new Map<string, unknown>([
      ["claim_id", "claim-1"],
      ["sequence", BigInt(1)],
      ["subject_id", "subject-1"],
      ["claim_text", "A canonical claim"],
      ["claim_hash", "claim-hash"],
      ["policy_id", "policy-1"],
      ["policy_fingerprint", "fingerprint"],
      ["proposer", ADDRESS],
      ["evidence_count", BigInt(2)],
      ["source_set_digest", "source-set"],
      ["evidence_expires_at", BigInt(2000)],
      ["supersedes_claim_id", ""],
      ["repairs_claim_id", ""],
      ["repair_child_claim_id", ""],
      ["superseded_by_claim_id", ""],
      ["state", "REPAIR_REQUIRED"],
      ["reason_code", "EVIDENCE_TOO_OLD"],
      ["repair_evidence_id", "evidence-1"],
      ["created_at", BigInt(1000)],
      ["review_deadline", BigInt(1500)],
      ["reviewed_at", BigInt(1200)],
      ["valid_until", BigInt(0)],
      ["state_changed_at", BigInt(1200)],
    ]);

    const decoded = decodeClaimRecord(claim);
    expect(decoded.state).toBe("REPAIR_REQUIRED");
    expect(decoded.reasonCode).toBe("EVIDENCE_TOO_OLD");
    expect(decoded.repairEvidenceId).toBe("evidence-1");
    expect(decoded.reviewDeadline).toBe(BigInt(1500));
  });
});
