import { describe, expect, it } from "vitest";

import * as memoryseal from "./index";

describe("MemorySeal client public exports", () => {
  it("exports typed read, decoding, surface, and pure write-intent layers", () => {
    expect(memoryseal.MemorySealReader).toBeTypeOf("function");
    expect(memoryseal.MemorySealWriteIntents).toBeTypeOf("function");
    expect(memoryseal.createBradburyFinalReadTransport).toBeTypeOf("function");
    expect(memoryseal.MEMORYSEAL_METHOD_SURFACE.totals.methods).toBe(30);
  });
});
