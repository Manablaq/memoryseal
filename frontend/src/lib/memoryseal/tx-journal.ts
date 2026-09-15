import { MEMORYSEAL_DEPLOYMENT } from "../../config/memoryseal";
import {
  MAIN_WRITE_METHODS,
  REGISTRY_WRITE_METHODS,
  type MemorySealWriteMethod,
} from "./surface";
import type { AddressHex } from "./types";

export interface MemorySealPendingTransactionV1 {
  version: 1;
  txHash: string;
  recordedAt: string;
}

export interface MemorySealPendingTransactionV2 {
  version: 2;
  txHash: string;
  recordedAt: string;
  chainId: number;
  account: AddressHex;
  contractAddress: AddressHex;
  functionName: MemorySealWriteMethod;
}

export type MemorySealPendingTransaction =
  | MemorySealPendingTransactionV1
  | MemorySealPendingTransactionV2;

export interface MemorySealPendingTransactionContext {
  chainId: number;
  account: AddressHex;
  contractAddress: AddressHex;
  functionName: MemorySealWriteMethod;
}

export interface MemorySealStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY =
  "memoryseal.pending-transaction.v2";
export const MEMORYSEAL_LEGACY_PENDING_TRANSACTION_STORAGE_KEY =
  "memoryseal.pending-transaction.v1";

const MEMORYSEAL_PENDING_TRANSACTION_EVENT =
  "memoryseal:pending-transaction-changed";
const transactionHashPattern = /^0x[0-9a-fA-F]{64}$/;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const registryMethods = new Set<string>(REGISTRY_WRITE_METHODS);
const mainMethods = new Set<string>(MAIN_WRITE_METHODS);

const browserWindow = (): Window | null =>
  typeof window === "undefined" ? null : window;

const browserStorages = (): MemorySealStorage[] => {
  const currentWindow = browserWindow();
  if (!currentWindow) return [];
  const stores: MemorySealStorage[] = [];
  try { stores.push(currentWindow.localStorage); } catch {}
  try { stores.push(currentWindow.sessionStorage); } catch {}
  return stores;
};

const resolveStorages = (storage?: MemorySealStorage | null): MemorySealStorage[] =>
  storage === undefined ? browserStorages() : storage ? [storage] : [];

const notifyBrowserSubscribers = (): void => {
  const currentWindow = browserWindow();
  if (!currentWindow) return;
  currentWindow.dispatchEvent(new Event(MEMORYSEAL_PENDING_TRANSACTION_EVENT));
};

const isAddress = (value: unknown): value is AddressHex =>
  typeof value === "string" && addressPattern.test(value);
const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const isCanonicalWriteContext = (
  contractAddress: AddressHex,
  functionName: string,
): functionName is MemorySealWriteMethod => {
  const normalized = contractAddress.toLowerCase();
  if (normalized === MEMORYSEAL_DEPLOYMENT.contracts.registry.toLowerCase()) {
    return registryMethods.has(functionName);
  }
  if (normalized === MEMORYSEAL_DEPLOYMENT.contracts.main.toLowerCase()) {
    return mainMethods.has(functionName);
  }
  return false;
};

type Parsed =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "valid"; record: MemorySealPendingTransaction };

const parseV2 = (raw: string): Parsed => {
  try {
    const p = JSON.parse(raw) as Partial<MemorySealPendingTransactionV2>;
    if (
      p.version !== 2 ||
      typeof p.txHash !== "string" ||
      !transactionHashPattern.test(p.txHash) ||
      !isIsoTimestamp(p.recordedAt) ||
      p.chainId !== MEMORYSEAL_DEPLOYMENT.network.chainId ||
      !isAddress(p.account) ||
      !isAddress(p.contractAddress) ||
      typeof p.functionName !== "string" ||
      !isCanonicalWriteContext(p.contractAddress, p.functionName)
    ) return { status: "invalid" };

    return { status: "valid", record: {
      version: 2,
      txHash: p.txHash,
      recordedAt: p.recordedAt,
      chainId: p.chainId,
      account: p.account,
      contractAddress: p.contractAddress,
      functionName: p.functionName,
    }};
  } catch { return { status: "invalid" }; }
};

const parseV1 = (raw: string): Parsed => {
  try {
    const p = JSON.parse(raw) as Partial<MemorySealPendingTransactionV1>;
    if (
      p.version !== 1 ||
      typeof p.txHash !== "string" ||
      !transactionHashPattern.test(p.txHash) ||
      !isIsoTimestamp(p.recordedAt)
    ) return { status: "invalid" };
    return { status: "valid", record: {
      version: 1, txHash: p.txHash, recordedAt: p.recordedAt,
    }};
  } catch { return { status: "invalid" }; }
};

const readOne = (storage: MemorySealStorage): Parsed => {
  try {
    const v2 = storage.getItem(MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY);
    if (v2 !== null) return parseV2(v2);
    const v1 = storage.getItem(MEMORYSEAL_LEGACY_PENDING_TRANSACTION_STORAGE_KEY);
    if (v1 !== null) return parseV1(v1);
    return { status: "none" };
  } catch { return { status: "invalid" }; }
};

export function recordMemorySealPendingTransaction(
  txHash: string,
  context: MemorySealPendingTransactionContext,
  storage?: MemorySealStorage | null,
): MemorySealPendingTransactionV2 | null {
  if (!transactionHashPattern.test(txHash)) {
    throw new Error("Cannot persist an invalid MemorySeal transaction hash.");
  }
  if (
    context.chainId !== MEMORYSEAL_DEPLOYMENT.network.chainId ||
    !isAddress(context.account) ||
    !isAddress(context.contractAddress) ||
    !isCanonicalWriteContext(context.contractAddress, context.functionName)
  ) {
    throw new Error(
      "Cannot persist a MemorySeal transaction outside the frozen Bradbury/account/contract/write context.",
    );
  }

  const record: MemorySealPendingTransactionV2 = {
    version: 2,
    txHash,
    recordedAt: new Date().toISOString(),
    chainId: context.chainId,
    account: context.account,
    contractAddress: context.contractAddress,
    functionName: context.functionName,
  };

  for (const target of resolveStorages(storage)) {
    try {
      target.setItem(MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY, JSON.stringify(record));
      target.removeItem(MEMORYSEAL_LEGACY_PENDING_TRANSACTION_STORAGE_KEY);
      notifyBrowserSubscribers();
      return record;
    } catch {}
  }
  return null;
}

export function readMemorySealPendingTransaction(
  storage?: MemorySealStorage | null,
): MemorySealPendingTransaction | null {
  for (const target of resolveStorages(storage)) {
    const parsed = readOne(target);
    if (parsed.status === "invalid") return null;
    if (parsed.status === "valid") return parsed.record;
  }
  return null;
}

export function clearMemorySealPendingTransaction(
  txHash?: string,
  storage?: MemorySealStorage | null,
): boolean {
  const stores = resolveStorages(storage);
  if (stores.length === 0) return false;
  const current = readMemorySealPendingTransaction(storage);
  if (txHash && current && current.txHash.toLowerCase() !== txHash.toLowerCase()) return false;
  let touched = false;
  for (const target of stores) {
    try {
      target.removeItem(MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY);
      target.removeItem(MEMORYSEAL_LEGACY_PENDING_TRANSACTION_STORAGE_KEY);
      touched = true;
    } catch {}
  }
  if (touched) notifyBrowserSubscribers();
  return touched;
}

export function getMemorySealPendingTransactionHash(): string {
  return readMemorySealPendingTransaction()?.txHash ?? "";
}
export function getMemorySealPendingTransactionServerHash(): string { return ""; }

export function getMemorySealPendingTransactionContextIssue(
  connectedAccount?: AddressHex,
): string | null {
  const record = readMemorySealPendingTransaction();
  if (!record) return null;
  if (record.version === 1) {
    return "This is a legacy recovery record without wallet/contract context. Tracking remains read-only and new writes stay locked until finalization.";
  }
  if (connectedAccount && record.account.toLowerCase() !== connectedAccount.toLowerCase()) {
    return "The pending transaction was submitted by a different wallet account. You may track finalization by hash, but new writes remain locked.";
  }
  return null;
}

export function subscribeMemorySealPendingTransaction(
  onStoreChange: () => void,
): () => void {
  const currentWindow = browserWindow();
  if (!currentWindow) return () => {};
  const onLocalChange = () => onStoreChange();
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY ||
      event.key === MEMORYSEAL_LEGACY_PENDING_TRANSACTION_STORAGE_KEY
    ) onStoreChange();
  };
  currentWindow.addEventListener(MEMORYSEAL_PENDING_TRANSACTION_EVENT, onLocalChange);
  currentWindow.addEventListener("storage", onStorage);
  return () => {
    currentWindow.removeEventListener(MEMORYSEAL_PENDING_TRANSACTION_EVENT, onLocalChange);
    currentWindow.removeEventListener("storage", onStorage);
  };
}
