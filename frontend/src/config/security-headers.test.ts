import { describe, expect, it } from "vitest";
import nextConfig, { MEMORYSEAL_SECURITY_HEADERS } from "../../next.config";

describe("MemorySeal browser security headers", () => {
  it("defines required defense-in-depth headers", () => {
    const headers = new Map(MEMORYSEAL_SECURITY_HEADERS.map(({ key, value }) => [key, value]));
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("https://rpc-bradbury.genlayer.com");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
  });
  it("applies headers to every route", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.source).toBe("/(.*)");
  });
});
