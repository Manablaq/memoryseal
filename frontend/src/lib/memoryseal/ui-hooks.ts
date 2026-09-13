"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  MemorySealReader,
  createBradburyFinalReadTransport,
} from "./index";

export function useMemorySealReader(): MemorySealReader {
  return useMemo(
    () => new MemorySealReader(createBradburyFinalReadTransport()),
    [],
  );
}

export function useProtocolOverview() {
  const reader = useMemorySealReader();

  return useQuery({
    queryKey: ["memoryseal", "overview", "latest-final"],
    queryFn: async () => {
      const [registry, owner, policyCount, evidenceCount, claimCount] =
        await Promise.all([
          reader.getRegistry(),
          reader.getOwner(),
          reader.getPolicyCount(),
          reader.getEvidenceCount(),
          reader.getClaimCount(),
        ]);

      return {
        registry,
        owner,
        policyCount,
        evidenceCount,
        claimCount,
      };
    },
  });
}

export function formatInteger(value: bigint | undefined): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function shortenHex(value: string, lead = 8, tail = 6): string {
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export function serializeForDisplay(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) =>
      typeof item === "bigint" ? item.toString(10) : item,
    2,
  );
}
