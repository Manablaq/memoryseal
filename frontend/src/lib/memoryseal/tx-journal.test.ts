import { describe, expect, it } from "vitest";

import {
  clearMemorySealPendingTransaction,
  MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY,
  readMemorySealPendingTransaction,
  recordMemorySealPendingTransaction,
  type MemorySealStorage,
} from "./tx-journal";

class MemoryStorage implements MemorySealStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const hashA = `0x${"11".repeat(32)}`;
const hashB = `0x${"22".repeat(32)}`;

describe("MemorySeal pending transaction journal", () => {
  it("persists and restores a valid submitted transaction hash", () => {
    const storage = new MemoryStorage();

    const written = recordMemorySealPendingTransaction(hashA, storage);
    const restored = readMemorySealPendingTransaction(storage);

    expect(written?.txHash).toBe(hashA);
    expect(restored?.txHash).toBe(hashA);
    expect(restored?.version).toBe(1);
    expect(restored?.recordedAt).toBeTruthy();
  });

  it("clears only the transaction hash being finalized", () => {
    const storage = new MemoryStorage();

    recordMemorySealPendingTransaction(hashA, storage);

    expect(clearMemorySealPendingTransaction(hashB, storage)).toBe(false);
    expect(readMemorySealPendingTransaction(storage)?.txHash).toBe(hashA);

    expect(clearMemorySealPendingTransaction(hashA, storage)).toBe(true);
    expect(readMemorySealPendingTransaction(storage)).toBeNull();
  });

  it("rejects invalid transaction hashes", () => {
    const storage = new MemoryStorage();

    expect(() =>
      recordMemorySealPendingTransaction("0x1234", storage),
    ).toThrow(/invalid MemorySeal transaction hash/i);
  });

  it("fails closed on malformed persisted data", () => {
    const storage = new MemoryStorage();

    storage.setItem(
      MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        txHash: "not-a-hash",
        recordedAt: "2026-09-15T00:00:00.000Z",
      }),
    );

    expect(readMemorySealPendingTransaction(storage)).toBeNull();
  });
});
