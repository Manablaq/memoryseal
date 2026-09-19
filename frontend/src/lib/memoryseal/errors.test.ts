import { describe, expect, it } from "vitest";

import {
  formatMemorySealError,
  getMemorySealErrorCode,
  isMemorySealUserRejectedError,
  memorySealErrorHasCode,
} from "./errors";

describe("MemorySeal readable error normalization", () => {
  it("extracts a nested EIP-1193 rejection without producing [object Object]", () => {
    const raw = {
      code: -32603,
      data: {
        originalError: {
          code: 4001,
          message: "User rejected the wallet request.",
        },
      },
    };

    expect(memorySealErrorHasCode(raw, 4001)).toBe(true);
    expect(getMemorySealErrorCode(raw)).toBe(4001);
    expect(isMemorySealUserRejectedError(raw)).toBe(true);

    const message = formatMemorySealError(raw);

    expect(message).toContain("User rejected the wallet request.");
    expect(message).toContain("provider code 4001");
    expect(message).not.toContain("[object Object]");
  });

  it("surfaces nested provider messages that do not carry a code", () => {
    const message = formatMemorySealError({
      data: {
        message: "Bradbury RPC is unavailable in the wallet provider.",
      },
    });

    expect(message).toBe(
      "Bradbury RPC is unavailable in the wallet provider.",
    );
  });

  it("serializes otherwise unreadable provider payloads instead of String(object)", () => {
    const message = formatMemorySealError({
      status: "wallet_failure",
      retryable: false,
    });

    expect(message).toContain("wallet_failure");
    expect(message).not.toContain("[object Object]");
  });
});
