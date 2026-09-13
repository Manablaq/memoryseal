import { describe, expect, it } from "vitest";

import { MEMORYSEAL_DEPLOYMENT } from "./memoryseal";

describe("frozen MemorySeal Bradbury deployment configuration", () => {
  it("binds the exact Bradbury network", () => {
    expect(MEMORYSEAL_DEPLOYMENT.network.chainId).toBe(4221);
    expect(MEMORYSEAL_DEPLOYMENT.network.rpcUrl).toBe(
      "https://rpc-bradbury.genlayer.com",
    );
  });

  it("binds the exact finalized Registry and Main addresses", () => {
    expect(MEMORYSEAL_DEPLOYMENT.contracts.main).toBe(
      "0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64",
    );
    expect(MEMORYSEAL_DEPLOYMENT.contracts.registry).toBe(
      "0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B",
    );
  });

  it("preserves frozen compatibility boundaries", () => {
    expect(MEMORYSEAL_DEPLOYMENT.compatibility.genlayerJsVersion).toBe("1.1.8");
    expect(
      MEMORYSEAL_DEPLOYMENT.compatibility.advancedLifecycleRpcSupported,
    ).toBe(false);
    expect(
      MEMORYSEAL_DEPLOYMENT.compatibility.automaticResubmissionOnAmbiguity,
    ).toBe(false);
    expect(MEMORYSEAL_DEPLOYMENT.compatibility.durableReadVariant).toBe(
      "LATEST_FINAL",
    );
  });

  it("binds the exact canonical Step 3 release", () => {
    expect(MEMORYSEAL_DEPLOYMENT.release.canonicalCommitSha).toBe(
      "0bdd8a6f0ffb4b6357d313eff0a3a4ed6704a8cb",
    );
    expect(MEMORYSEAL_DEPLOYMENT.release.canonicalTreeSha).toBe(
      "32958bde41c4927d1302f5f77c6792f447ab9a92",
    );
    expect(MEMORYSEAL_DEPLOYMENT.release.mainSourceSha256).toBe(
      "4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c",
    );
    expect(MEMORYSEAL_DEPLOYMENT.release.registrySourceSha256).toBe(
      "ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b",
    );
  });
});
