import { expect, test, type Page } from "@playwright/test";

const blockBradburyRpc = async (page: Page) => {
  await page.route(
    "https://rpc-bradbury.genlayer.com/**",
    async (route) => route.abort(),
  );
};

test.describe("MemorySeal product and protocol truth", () => {
  test.beforeEach(async ({ page }) => {
    await blockBradburyRpc(page);
  });

  test("landing page presents the protocol and frozen deployment truthfully", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Claims should not become",
    );
    await expect(
      page.getByText("Evidence-bound canonical memory", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("LATEST_FINAL", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Canonical reads never depend on provisional Accepted state.",
        { exact: true },
      ),
    ).toBeVisible();

    await expect(page.getByText("Policies", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Finalized read unavailable", { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Inspect live memory/i }),
    ).toHaveAttribute("href", "/app");
  });

  test("workspace degrades to explicit unavailable state instead of invented data", async ({
    page,
  }) => {
    await page.goto("/app");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Finalized memory, inspected at the source/i,
      }),
    ).toBeVisible();

    await expect(page.getByText("Bradbury · 4221", { exact: true })).toBeVisible();
    await expect(page.getByText("LATEST_FINAL", { exact: true })).toBeVisible();

    const unavailable = page.getByText("Unavailable", { exact: true });
    await expect(unavailable).toHaveCount(4);

    await expect(
      page.getByText("Direct identifier inspection", { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Bound writes with explicit finality.",
      }),
    ).toBeVisible();

    await expect(
      page.getByText(
        /durable success requires finalization plus successful execution/i,
      ),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Review in wallet" }),
    ).toBeDisabled();

    await expect(
      page.getByRole("button", { name: "Connect wallet" }),
    ).toBeVisible();

    await expect(
      page.getByText("Transaction submission locked until 4H", { exact: true }),
    ).toHaveCount(0);
  });

  test("workspace exposes exactly the frozen ten write actions without arbitrary method input", async ({
    page,
  }) => {
    await page.goto("/app");

    const actions = [
      "Create policy",
      "Approve issuer",
      "Approve origin",
      "Seal policy",
      "Register evidence",
      "Propose claim",
      "Propose repair",
      "Cancel claim",
      "Expire claim",
      "Review claim",
    ];

    for (const action of actions) {
      await expect(page.getByRole("button", { name: new RegExp(`^${action}`) })).toBeVisible();
    }

    await expect(page.locator('input[name="contractAddress"]')).toHaveCount(0);
    await expect(page.locator('input[name="functionName"]')).toHaveCount(0);

    await expect(
      page.getByText(/Resume an existing transaction/i),
    ).toBeVisible();
    await expect(
      page.getByText(/never resubmits the underlying write/i),
    ).toBeVisible();
  });
});
