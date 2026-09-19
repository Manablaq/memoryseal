const MESSAGE_KEYS = [
  "shortMessage",
  "message",
  "reason",
  "details",
] as const;

const NESTED_ERROR_KEYS = [
  "error",
  "cause",
  "data",
  "originalError",
] as const;

const MAX_ERROR_DEPTH = 6;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeErrorCode = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }

  return undefined;
};

const collectErrorCodes = (
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
): number[] => {
  if (depth > MAX_ERROR_DEPTH || !isRecord(value)) return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const codes: number[] = [];
  const ownCode = normalizeErrorCode(value.code);
  if (ownCode !== undefined) codes.push(ownCode);

  for (const key of NESTED_ERROR_KEYS) {
    const nested = value[key];
    if (nested !== undefined) {
      codes.push(...collectErrorCodes(nested, depth + 1, seen));
    }
  }

  return codes;
};

const findErrorMessage = (
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
): string | null => {
  if (depth > MAX_ERROR_DEPTH) return null;

  if (typeof value === "string") {
    const message = value.trim();
    return message.length > 0 ? message : null;
  }

  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message.trim();
  }

  if (!isRecord(value)) return null;
  if (seen.has(value)) return null;
  seen.add(value);

  for (const key of MESSAGE_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  for (const key of NESTED_ERROR_KEYS) {
    const nested = value[key];
    if (nested !== undefined) {
      const nestedMessage = findErrorMessage(nested, depth + 1, seen);
      if (nestedMessage) return nestedMessage;
    }
  }

  return null;
};

const serializeUnknownError = (value: unknown): string | null => {
  try {
    const serialized = JSON.stringify(value, (_key, item) => {
      if (typeof item === "bigint") return item.toString(10);

      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
        };
      }

      return item;
    });

    if (!serialized || serialized === "{}") return null;
    return serialized;
  } catch {
    return null;
  }
};

export function getMemorySealErrorCode(
  error: unknown,
): number | undefined {
  const codes = collectErrorCodes(error);

  if (codes.includes(4001)) return 4001;
  if (codes.includes(4902)) return 4902;

  return codes[0];
}

export function memorySealErrorHasCode(
  error: unknown,
  expectedCode: number,
): boolean {
  return collectErrorCodes(error).includes(expectedCode);
}

export function formatMemorySealError(
  error: unknown,
  fallback = "MemorySeal request failed.",
): string {
  const message = findErrorMessage(error);
  const code = getMemorySealErrorCode(error);

  if (message) {
    if (code !== undefined && !message.includes(String(code))) {
      return `${message} (provider code ${code})`;
    }

    return message;
  }

  const serialized = serializeUnknownError(error);
  if (serialized) {
    return code === undefined
      ? `${fallback} Provider response: ${serialized}`
      : `${fallback} Provider response: ${serialized} (provider code ${code})`;
  }

  return code === undefined
    ? fallback
    : `${fallback} (provider code ${code})`;
}

export function isMemorySealUserRejectedError(
  error: unknown,
): boolean {
  if (memorySealErrorHasCode(error, 4001)) return true;

  return /user (rejected|denied|cancelled|canceled)/i.test(
    formatMemorySealError(error, ""),
  );
}
