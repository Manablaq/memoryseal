import { expect, test, type Page } from "@playwright/test";

const walletAddress =
  "0x1212121212121212121212121212121212121212";

type WalletRequestRecord = {
  method: string;
  params?: readonly unknown[] | object;
};

type WalletProbeWindow = typeof window & {
  __memorysealWalletRequests?: WalletRequestRecord[];
  ethereum?: {
    request(args: {
      method: string;
      params?: readonly unknown[] | object;
    }): Promise<unknown>;
  };
};

type WalletScenario =
  | "known-wrong-chain"
  | "unknown-chain"
  | "reject-switch";

const blockBradburyRpc = async (page: Page) => {
  await page.route(
    "https://rpc-bradbury.genlayer.com/**",
    async (route) => route.abort(),
  );
};

const installWalletFixture = async (
  page: Page,
  scenario: WalletScenario,
) => {
  await page.addInitScript(
    ({ scenario, walletAddress }) => {
      const probeWindow = window as WalletProbeWindow;
      let chainId = "0x1";
      let bradburyAdded = false;

      probeWindow.__memorysealWalletRequests = [];

      Object.defineProperty(probeWindow, "ethereum", {
        configurable: true,
        value: {
          async request({
            method,
            params,
          }: {
            method: string;
            params?: readonly unknown[] | object;
          }): Promise<unknown> {
            probeWindow.__memorysealWalletRequests?.push({
              method,
              params,
            });

            switch (method) {
              case "eth_requestAccounts":
              case "eth_accounts":
                return [walletAddress];

              case "eth_chainId":
                return chainId;

              case "wallet_switchEthereumChain":
                if (scenario === "reject-switch") {
                  throw {
                    code: 4001,
                    message:
                      "Reviewer probe: user rejected Bradbury network switch.",
                  };
                }

                if (
                  scenario === "unknown-chain" &&
                  !bradburyAdded
                ) {
                  throw {
                    code: 4902,
                    message:
                      "Reviewer probe: Bradbury is not configured in this wallet.",
                  };
                }

                chainId = "0x107d";
                return null;

              case "wallet_addEthereumChain":
                bradburyAdded = true;
                return null;

              case "wallet_getSnaps":
              case "wallet_requestSnaps":
                throw new Error(
                  `MemorySeal must not require MetaMask Snap method ${method}.`,
                );

              default:
                throw new Error(
                  `Unexpected wallet request in reviewer E2E probe: ${method}`,
                );
            }
          },
        },
      });
    },
    {
      scenario,
      walletAddress,
    },
  );
};

const walletRequests = async (
  page: Page,
): Promise<WalletRequestRecord[]> =>
  page.evaluate(() => {
    const probeWindow = window as WalletProbeWindow;
    return [...(probeWindow.__memorysealWalletRequests ?? [])];
  });

test.describe("MemorySeal injected wallet + Bradbury reviewer flow", () => {
  test.beforeEach(async ({ page }) => {
    await blockBradburyRpc(page);
  });

  test("connects a generic injected wallet by switching it to Bradbury 4221 without Snap APIs", async ({
    page,
  }) => {
    await installWalletFixture(page, "known-wrong-chain");
    await page.goto("/app");

    await page.getByRole("button", { name: "Connect wallet" }).click();

    await expect(
      page.getByRole("button", {
        name: "Reconnect / verify Bradbury",
      }),
    ).toBeVisible();

    await expect(
      page.getByText("Wallet ready", { exact: true }),
    ).toBeVisible();

    const requests = await walletRequests(page);
    const methods = requests.map(({ method }) => method);

    expect(methods).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);
    expect(methods).not.toContain("wallet_getSnaps");
    expect(methods).not.toContain("wallet_requestSnaps");

    const switchRequest = requests.find(
      ({ method }) => method === "wallet_switchEthereumChain",
    );
    expect(switchRequest?.params).toEqual([
      { chainId: "0x107d" },
    ]);
  });

  test("adds the canonical Bradbury wallet configuration after provider code 4902", async ({
    page,
  }) => {
    await installWalletFixture(page, "unknown-chain");
    await page.goto("/app");

    await page.getByRole("button", { name: "Connect wallet" }).click();

    await expect(
      page.getByRole("button", {
        name: "Reconnect / verify Bradbury",
      }),
    ).toBeVisible();

    const requests = await walletRequests(page);
    const addRequest = requests.find(
      ({ method }) => method === "wallet_addEthereumChain",
    );

    expect(addRequest).toBeDefined();

    const params = addRequest?.params as readonly unknown[];
    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({
      chainId: "0x107d",
      nativeCurrency: {
        symbol: "GEN",
        decimals: 18,
      },
      rpcUrls: ["https://rpc-bradbury.genlayer.com"],
      blockExplorerUrls: [
        "https://explorer-bradbury.genlayer.com/",
      ],
    });

    const methods = requests.map(({ method }) => method);
    expect(methods).not.toContain("wallet_getSnaps");
    expect(methods).not.toContain("wallet_requestSnaps");
  });

  test("shows the actual structured provider error when the network switch is rejected", async ({
    page,
  }) => {
    await installWalletFixture(page, "reject-switch");
    await page.goto("/app");

    await page.getByRole("button", { name: "Connect wallet" }).click();

    await expect(
      page.getByText("Wallet request rejected", { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByText(
        /Reviewer probe: user rejected Bradbury network switch\./i,
      ),
    ).toBeVisible();

    await expect(
      page.getByText(/provider code 4001/i),
    ).toBeVisible();

    await expect(
      page.getByText("[object Object]", { exact: true }),
    ).toHaveCount(0);
  });
});
