export const MEMORYSEAL_DEPLOYMENT = {
  network: {
    name: "GenLayer Bradbury Testnet",
    chainId: 4221,
    rpcUrl: "https://rpc-bradbury.genlayer.com",
    explorerUrl: "https://explorer-bradbury.genlayer.com",
  },
  contracts: {
    main: "0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64",
    registry: "0xd5f0B44394810bBaEBd7cfd5D44b3B568895bd8B",
  },
  deploymentTransactions: {
    main: "0x1ad87fe39cb422ccdd8697a0dff82db60bb73ddd210a631b7f09c38097c88386",
    registry: "0x898aeb539d521f5f72aae2d92872ce0dad5716a70e3c64d4f79b9b0f74a0d160",
  },
  release: {
    contractCommitSha: "0bdd8a6f0ffb4b6357d313eff0a3a4ed6704a8cb",
    contractTreeSha: "32958bde41c4927d1302f5f77c6792f447ab9a92",
    mainSourceSha256: "4aa0a9c1a5da486aa3c4730424212def4a95d500d9b55242000e07d8f8df892c",
    registrySourceSha256: "ac7a08ac5a57636a8b8fcb100a1e1b1d37ee2a8841bee304c828472b064de90b",
    contractSubmissionPacketSha256: "c9d3241500f0ac97c108a56b83a7a58d7dad19f506cb346370458e5d89bd01c3",
    frontendHardeningBaseCommitSha: "3256b7e8f59b6cb696d8f15fa781a6a689829caa",
    frontendHardeningBaseTreeSha: "ff5ff7958b42a3e1a3070e47bc4181a0168ceca5",
  },
  compatibility: {
    genlayerJsVersion: "1.1.8",
    consensusSurface: "Bradbury v0.5",
    durableReadVariant: "LATEST_FINAL",
    advancedLifecycleRpcSupported: false,
    automaticResubmissionOnAmbiguity: false,
  },
} as const;

export type MemorySealDeployment = typeof MEMORYSEAL_DEPLOYMENT;
