import { expect, test, type Page } from "@playwright/test";

const blockBradburyRpc = async (page: Page) => {
  await page.route(
    "https://rpc-bradbury.genlayer.com/**",
    async (route) => route.abort(),
  );
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));

  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
};

const expectAccessibleInteractiveNames = async (page: Page) => {
  const unnamed = await page.evaluate(() => {
    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], input, textarea, select',
      ),
    );

    const labelText = (element: HTMLElement): string => {
      const aria = element.getAttribute("aria-label")?.trim();
      if (aria) return aria;

      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const value = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .join(" ")
          .trim();
        if (value) return value;
      }

      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        const labels = Array.from(element.labels ?? [])
          .map((label) => label.textContent?.trim() ?? "")
          .join(" ")
          .trim();
        if (labels) return labels;

        const placeholder = element.getAttribute("placeholder")?.trim();
        if (placeholder) return placeholder;
      }

      return element.textContent?.trim() ?? "";
    };

    return interactive
      .filter((element) => {
        if (
          element instanceof HTMLButtonElement &&
          element.disabled
        ) {
          return false;
        }
        return !labelText(element);
      })
      .map((element) => element.outerHTML.slice(0, 240));
  });

  expect(unnamed).toEqual([]);
};

test.describe("MemorySeal responsive and accessibility guardrails", () => {
  test.beforeEach(async ({ page }) => {
    await blockBradburyRpc(page);
  });

  test("desktop workspace has landmarks, accessible controls, keyboard focus, and no overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app");

    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    await expectAccessibleInteractiveNames(page);
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  });

  test("mobile landing and workspace remain within viewport and honor reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/");
    await expectNoHorizontalOverflow(page);

    const landingScrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    );
    expect(landingScrollBehavior).toBe("auto");

    await page.goto("/app");
    await expectNoHorizontalOverflow(page);

    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bound writes with explicit finality." }),
    ).toBeVisible();

    await expectAccessibleInteractiveNames(page);
  });
});
