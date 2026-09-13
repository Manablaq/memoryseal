import { describe, expect, it } from "vitest";

import {
  CLAIM_STATES,
  MAIN_VIEW_METHODS,
  MAIN_WRITE_METHODS,
  MEMORYSEAL_DISCOVERY_POLICY,
  MEMORYSEAL_METHOD_SURFACE,
  REGISTRY_VIEW_METHODS,
  REGISTRY_WRITE_METHODS,
} from "./surface";

describe("MemorySeal frozen public method surface", () => {
  it("contains exactly 20 views and 10 writes", () => {
    expect(REGISTRY_VIEW_METHODS).toHaveLength(12);
    expect(REGISTRY_WRITE_METHODS).toHaveLength(5);
    expect(MAIN_VIEW_METHODS).toHaveLength(8);
    expect(MAIN_WRITE_METHODS).toHaveLength(5);
    expect(MEMORYSEAL_METHOD_SURFACE.totals).toEqual({
      views: 20,
      writes: 10,
      methods: 30,
    });
  });

  it("contains no duplicate method names within a contract", () => {
    const registry = [...REGISTRY_VIEW_METHODS, ...REGISTRY_WRITE_METHODS];
    const main = [...MAIN_VIEW_METHODS, ...MAIN_WRITE_METHODS];
    expect(new Set(registry).size).toBe(registry.length);
    expect(new Set(main).size).toBe(main.length);
  });

  it("preserves all seven claim states as distinct values", () => {
    expect(CLAIM_STATES).toEqual([
      "REVIEWABLE",
      "SUPPORTED",
      "REJECTED",
      "REPAIR_REQUIRED",
      "SUPERSEDED",
      "CANCELED",
      "EXPIRED",
    ]);
  });

  it("forbids inventing global lists from count-only reads", () => {
    expect(MEMORYSEAL_DISCOVERY_POLICY.globalListsFromCountsAllowed).toBe(false);
  });
});
