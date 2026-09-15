import { describe, expect, it } from "vitest";
import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";
import {
  clearMemorySealPendingTransaction,
  MEMORYSEAL_LEGACY_PENDING_TRANSACTION_STORAGE_KEY,
  MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY,
  readMemorySealPendingTransaction,
  recordMemorySealPendingTransaction,
  type MemorySealPendingTransactionContext,
  type MemorySealStorage,
} from "./tx-journal";

class MemoryStorage implements MemorySealStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const hashA = `0x${"11".repeat(32)}`;
const hashB = `0x${"22".repeat(32)}`;
const account = "0x1212121212121212121212121212121212121212";
const context: MemorySealPendingTransactionContext = {
  chainId: 4221,
  account,
  contractAddress: MEMORYSEAL_DEPLOYMENT.contracts.registry,
  functionName: "create_policy",
};

describe("MemorySeal pending transaction journal", () => {
  it("persists v2 bound context", () => {
    const storage = new MemoryStorage();
    const written = recordMemorySealPendingTransaction(hashA, context, storage);
    expect(written).toMatchObject({ version: 2, txHash: hashA, chainId: 4221, account, functionName: "create_policy" });
    expect(readMemorySealPendingTransaction(storage)).toEqual(written);
  });

  it("preserves legacy v1 hash recovery without inventing context", () => {
    const storage = new MemoryStorage();
    storage.setItem(MEMORYSEAL_LEGACY_PENDING_TRANSACTION_STORAGE_KEY, JSON.stringify({
      version: 1, txHash: hashA, recordedAt: "2026-09-15T00:00:00.000Z",
    }));
    expect(readMemorySealPendingTransaction(storage)?.version).toBe(1);
    expect(readMemorySealPendingTransaction(storage)?.txHash).toBe(hashA);
  });

  it("clears only the hash being finalized", () => {
    const storage = new MemoryStorage();
    recordMemorySealPendingTransaction(hashA, context, storage);
    expect(clearMemorySealPendingTransaction(hashB, storage)).toBe(false);
    expect(clearMemorySealPendingTransaction(hashA, storage)).toBe(true);
    expect(readMemorySealPendingTransaction(storage)).toBeNull();
  });

  it("rejects invalid hash, wrong chain, wrong contract/method pairing", () => {
    const storage = new MemoryStorage();
    expect(() => recordMemorySealPendingTransaction("0x1234", context, storage)).toThrow(/invalid MemorySeal transaction hash/i);
    expect(() => recordMemorySealPendingTransaction(hashA, { ...context, chainId: 1 }, storage)).toThrow(/frozen Bradbury/i);
    expect(() => recordMemorySealPendingTransaction(hashA, { ...context, functionName: "review_claim" }, storage)).toThrow(/frozen Bradbury/i);
  });

  it("fails closed on malformed or wrong-chain persisted v2 data", () => {
    const storage = new MemoryStorage();
    storage.setItem(MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY, JSON.stringify({
      version: 2,
      txHash: hashA,
      recordedAt: "2026-09-15T00:00:00.000Z",
      chainId: 1,
      account,
      contractAddress: MEMORYSEAL_DEPLOYMENT.contracts.registry,
      functionName: "create_policy",
    }));
    expect(readMemorySealPendingTransaction(storage)).toBeNull();
  });
});
