import { expect, test, type Page } from "@playwright/test";

const pendingHash =
  "0xabababababababababababababababababababababababababababababababab";
const walletAddress = "0x1212121212121212121212121212121212121212";
const storageKey = "memoryseal.pending-transaction.v2";
const seedKey = "memoryseal.e2e.pending-seeded";

type WalletProbeWindow = typeof window & {
  __memorysealWalletRequests?: string[];
  ethereum?: {
    request(args: {
      method: string;
      params?: readonly unknown[] | object;
    }): Promise<unknown>;
  };
};

const blockBradburyRpc = async (page: Page) => {
  await page.route(
    "https://rpc-bradbury.genlayer.com/**",
    async (route) => route.abort(),
  );
};

const installPendingTransactionFixture = async (page: Page) => {
  await page.addInitScript(
    ({ pendingHash, seedKey, storageKey, walletAddress }) => {
      const probeWindow = window as WalletProbeWindow;

      if (window.sessionStorage.getItem(seedKey) !== "1") {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 2,
            txHash: pendingHash,
            recordedAt: "2026-09-15T00:00:00.000Z",
            chainId: 4221,
            account: walletAddress,
            contractAddress:
              "0x3f11F12647b1d91C39F9edDE14f7bFD0486f9f64",
            functionName: "review_claim",
          }),
        );
        window.sessionStorage.setItem(seedKey, "1");
      }

      probeWindow.__memorysealWalletRequests = [];

      Object.defineProperty(probeWindow, "ethereum", {
        configurable: true,
        value: {
          async request({
            method,
          }: {
            method: string;
            params?: readonly unknown[] | object;
          }): Promise<unknown> {
            probeWindow.__memorysealWalletRequests?.push(method);

            switch (method) {
              case "eth_requestAccounts":
              case "eth_accounts":
                return [walletAddress];
              case "eth_chainId":
                return "0x107d";
              case "wallet_getSnaps":
                return {};
              case "wallet_requestSnaps":
                return {};
              case "wallet_addEthereumChain":
              case "wallet_switchEthereumChain":
                return null;
              default:
                throw new Error(`Unexpected wallet request in E2E probe: ${method}`);
            }
          },
        },
      });
    },
    {
      pendingHash,
      seedKey,
      storageKey,
      walletAddress,
    },
  );
};

const walletRequests = async (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const probeWindow = window as WalletProbeWindow;
    return [...(probeWindow.__memorysealWalletRequests ?? [])];
  });

const persistedPendingHash = async (page: Page): Promise<string | null> =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as { txHash?: unknown };
      return typeof parsed.txHash === "string" ? parsed.txHash : null;
    } catch {
      return null;
    }
  }, storageKey);

test.describe("MemorySeal durable transaction recovery", () => {
  test.beforeEach(async ({ page }) => {
    await blockBradburyRpc(page);
    await installPendingTransactionFixture(page);
  });

  test("restores the recorded hash after reload and locks duplicate write submission", async ({
    page,
  }) => {
    await page.goto("/app");

    const recoveryInput = page.locator(
      'input[placeholder*="transaction hash"]',
    );

    await expect(recoveryInput).toHaveValue(pendingHash);
    await expect(
      page.getByText(/A recorded transaction is still pending/i),
    ).toBeVisible();

    await page.waitForTimeout(250);
    expect(await walletRequests(page)).toEqual([]);
    expect(await persistedPendingHash(page)).toBe(pendingHash);

    await page.getByRole("button", { name: "Connect wallet" }).click();

    await expect(
      page.getByRole("button", { name: "Reconnect / verify Bradbury" }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Review in wallet" }),
    ).toBeDisabled();

    const requestsAfterConnect = await walletRequests(page);

    expect(requestsAfterConnect).toContain("eth_requestAccounts");
    expect(requestsAfterConnect).not.toContain("eth_sendTransaction");
    expect(requestsAfterConnect).not.toContain("eth_sendRawTransaction");
    expect(requestsAfterConnect).not.toContain("wallet_invokeSnap");
    expect(requestsAfterConnect).not.toContain("personal_sign");
    expect(
      requestsAfterConnect.some((method) =>
        method.toLowerCase().startsWith("eth_signtypeddata"),
      ),
    ).toBe(false);

    expect(await persistedPendingHash(page)).toBe(pendingHash);

    await page.reload();

    await expect(recoveryInput).toHaveValue(pendingHash);
    await expect(
      page.getByText(/A recorded transaction is still pending/i),
    ).toBeVisible();

    await page.waitForTimeout(250);
    expect(await walletRequests(page)).toEqual([]);
    expect(await persistedPendingHash(page)).toBe(pendingHash);
  });

  test("resume tracking never invokes the wallet and preserves the journal on tracking failure", async ({
    page,
  }) => {
    await page.goto("/app");

    const recoveryInput = page.locator(
      'input[placeholder*="transaction hash"]',
    );

    await expect(recoveryInput).toHaveValue(pendingHash);
    expect(await walletRequests(page)).toEqual([]);

    await page.getByRole("button", { name: "Resume finalization" }).click();

    await expect(
      page.getByText(
        /Outcome uncertain — resume by transaction hash, do not resubmit/i,
      ),
    ).toBeVisible({ timeout: 15_000 });

    expect(await walletRequests(page)).toEqual([]);
    expect(await persistedPendingHash(page)).toBe(pendingHash);

    await page.reload();

    await expect(recoveryInput).toHaveValue(pendingHash);
    expect(await persistedPendingHash(page)).toBe(pendingHash);

    await page.waitForTimeout(250);
    expect(await walletRequests(page)).toEqual([]);
  });

  test("warns when connected wallet differs from the bound recovery account", async ({ page }) => {
    await page.goto("/app");
    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error("missing pending fixture");
      const parsed = JSON.parse(raw) as { account?: string };
      parsed.account = "0x3434343434343434343434343434343434343434";
      window.localStorage.setItem(key, JSON.stringify(parsed));
    }, storageKey);
    await page.reload();
    await page.getByRole("button", { name: "Connect wallet" }).click();
    await expect(page.getByText(/submitted by a different wallet account/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Review in wallet" })).toBeDisabled();
  });

  test("fails closed on a pending journal bound to the wrong chain", async ({ page }) => {
    await page.goto("/app");
    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error("missing pending fixture");
      const parsed = JSON.parse(raw) as { chainId?: number };
      parsed.chainId = 1;
      window.localStorage.setItem(key, JSON.stringify(parsed));
    }, storageKey);
    await page.reload();
    await expect(page.locator('input[placeholder*="transaction hash"]')).toHaveValue("");
    await expect(page.getByText(/A recorded transaction is still pending/i)).toHaveCount(0);
  });
});
