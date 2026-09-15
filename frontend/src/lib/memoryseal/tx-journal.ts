export interface MemorySealPendingTransaction {
  version: 1;
  txHash: string;
  recordedAt: string;
}

export interface MemorySealStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY =
  "memoryseal.pending-transaction.v1";

const MEMORYSEAL_PENDING_TRANSACTION_EVENT =
  "memoryseal:pending-transaction-changed";

const transactionHashPattern = /^0x[0-9a-fA-F]{64}$/;

const browserWindow = (): Window | null =>
  typeof window === "undefined" ? null : window;

const browserStorage = (): MemorySealStorage | null => {
  const currentWindow = browserWindow();
  if (!currentWindow) return null;

  try {
    return currentWindow.localStorage;
  } catch {
    return null;
  }
};

const resolveStorage = (
  storage?: MemorySealStorage | null,
): MemorySealStorage | null =>
  storage === undefined ? browserStorage() : storage;

const notifyBrowserSubscribers = (): void => {
  const currentWindow = browserWindow();
  if (!currentWindow) return;

  currentWindow.dispatchEvent(
    new Event(MEMORYSEAL_PENDING_TRANSACTION_EVENT),
  );
};

export function recordMemorySealPendingTransaction(
  txHash: string,
  storage?: MemorySealStorage | null,
): MemorySealPendingTransaction | null {
  if (!transactionHashPattern.test(txHash)) {
    throw new Error(
      "Cannot persist an invalid MemorySeal transaction hash.",
    );
  }

  const target = resolveStorage(storage);
  if (!target) return null;

  const record: MemorySealPendingTransaction = {
    version: 1,
    txHash,
    recordedAt: new Date().toISOString(),
  };

  try {
    target.setItem(
      MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY,
      JSON.stringify(record),
    );
    notifyBrowserSubscribers();
    return record;
  } catch {
    return null;
  }
}

export function readMemorySealPendingTransaction(
  storage?: MemorySealStorage | null,
): MemorySealPendingTransaction | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(
      MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY,
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<MemorySealPendingTransaction>;

    if (
      parsed.version !== 1 ||
      typeof parsed.txHash !== "string" ||
      !transactionHashPattern.test(parsed.txHash) ||
      typeof parsed.recordedAt !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      txHash: parsed.txHash,
      recordedAt: parsed.recordedAt,
    };
  } catch {
    return null;
  }
}

export function clearMemorySealPendingTransaction(
  txHash?: string,
  storage?: MemorySealStorage | null,
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    if (txHash) {
      const current = readMemorySealPendingTransaction(target);
      if (
        current &&
        current.txHash.toLowerCase() !== txHash.toLowerCase()
      ) {
        return false;
      }
    }

    target.removeItem(MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY);
    notifyBrowserSubscribers();
    return true;
  } catch {
    return false;
  }
}

export function getMemorySealPendingTransactionHash(): string {
  return readMemorySealPendingTransaction()?.txHash ?? "";
}

export function getMemorySealPendingTransactionServerHash(): string {
  return "";
}

export function subscribeMemorySealPendingTransaction(
  onStoreChange: () => void,
): () => void {
  const currentWindow = browserWindow();
  if (!currentWindow) return () => {};

  const onLocalChange = () => {
    onStoreChange();
  };

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === MEMORYSEAL_PENDING_TRANSACTION_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };

  currentWindow.addEventListener(
    MEMORYSEAL_PENDING_TRANSACTION_EVENT,
    onLocalChange,
  );
  currentWindow.addEventListener("storage", onStorage);

  return () => {
    currentWindow.removeEventListener(
      MEMORYSEAL_PENDING_TRANSACTION_EVENT,
      onLocalChange,
    );
    currentWindow.removeEventListener("storage", onStorage);
  };
}
