import { describe, expect, it } from "vitest";

import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";

import { MemorySealReader, type MemorySealReadRequest } from "./reader";
import type { AddressHex } from "./types";

const ADDRESS = "0x1111111111111111111111111111111111111111" as AddressHex;

describe("MemorySealReader", () => {
  it("routes Registry and Main reads only to the frozen addresses", async () => {
    const requests: MemorySealReadRequest[] = [];
    const reader = new MemorySealReader({
      async readContract(request) {
        requests.push(request);
        if (request.functionName === "get_owner") {
          return ADDRESS;
        }
        if (request.functionName === "get_claim_count") {
          return BigInt(3);
        }
        throw new Error(`unexpected method: ${request.functionName}`);
      },
    });

    await expect(reader.getOwner()).resolves.toBe(ADDRESS);
    await expect(reader.getClaimCount()).resolves.toBe(BigInt(3));

    expect(requests[0]?.address).toBe(MEMORYSEAL_DEPLOYMENT.contracts.registry);
    expect(requests[0]?.functionName).toBe("get_owner");
    expect(requests[1]?.address).toBe(MEMORYSEAL_DEPLOYMENT.contracts.main);
    expect(requests[1]?.functionName).toBe("get_claim_count");
  });

  it("preserves subject-scoped history discovery", async () => {
    const requests: MemorySealReadRequest[] = [];
    const reader = new MemorySealReader({
      async readContract(request) {
        requests.push(request);
        return request.functionName === "get_subject_history_count"
          ? BigInt(2)
          : "claim-2";
      },
    });

    await expect(reader.getSubjectHistoryCount("subject-a")).resolves.toBe(BigInt(2));
    await expect(
      reader.getSubjectHistoryClaimId("subject-a", BigInt(1)),
    ).resolves.toBe("claim-2");

    expect(requests.map((request) => request.functionName)).toEqual([
      "get_subject_history_count",
      "get_subject_history_claim_id",
    ]);
  });
});
