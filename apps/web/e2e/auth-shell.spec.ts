import { expect, test } from "@playwright/test";

async function breadcrumbTitleGap(page: import("@playwright/test").Page) {
  const breadcrumb = await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .boundingBox();
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox();

  expect(breadcrumb).not.toBeNull();
  expect(heading).not.toBeNull();

  return heading!.y - (breadcrumb!.y + breadcrumb!.height);
}

test("opens the manager product at the dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Data sources" }),
  ).toBeVisible();
  const operation = page.getByRole("navigation", { name: "Operations" });
  await expect(operation.getByText("Operations", { exact: true })).toBeVisible();
  await expect(
    operation.getByRole("link", { name: "Overview" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    operation.getByRole("link", { name: "Sessions" }),
  ).toHaveAttribute("href", "/sessions");
  await expect(operation.locator('[aria-disabled="true"]')).toHaveCount(0);
});

test("separates the product identity from the GoodWe installation context", async ({
  page,
}) => {
  await page.goto("/dashboard");

  const productIdentity = page.locator(".product-identity");
  // The partnership mark lives at the foot of the rail, away from the product's
  // own name, and in the interface's ink rather than the partner's red.
  const partnership = page.locator(".product-rail .product-partnership");
  const appHeader = page.getByRole("banner");

  await expect(
    partnership.getByRole("img", {
      name: "GoodWe: Smart Energy Innovator",
    }),
  ).toBeVisible();
  await expect(partnership.getByText("FIAP Challenge")).toBeVisible();
  await expect(productIdentity.getByText("FIAP Challenge")).toHaveCount(0);
  await expect(productIdentity.getByRole("img")).toHaveCount(0);
  const fiapMetrics = await partnership
    .getByText("FIAP Challenge")
    .evaluate((element) => ({
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      fontFamily: getComputedStyle(element).fontFamily,
      height: element.getBoundingClientRect().height,
    }));
  const productFontFamily = await productIdentity
    .getByText("EV ChargeOps")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  const crossFontSize = await partnership
    .getByText("×")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const goodWeHeight = await partnership
    .getByRole("img", { name: "GoodWe: Smart Energy Innovator" })
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(fiapMetrics.fontFamily).toBe(productFontFamily);
  expect(crossFontSize).toBeLessThan(fiapMetrics.fontSize);
  expect(fiapMetrics.fontSize / goodWeHeight).toBeGreaterThanOrEqual(0.9);
  expect(Math.abs(fiapMetrics.height - goodWeHeight)).toBeLessThanOrEqual(0.25);
  await expect(
    productIdentity.getByText("Powered by GoodWe / SEMS+"),
  ).toHaveCount(0);
  await expect(appHeader.getByText("Powered by GoodWe / SEMS+")).toBeVisible();
  await expect(
    appHeader.getByText(
      "Site: Parkview Residences · 1 charger",
    ),
  ).toBeVisible();
});

test("allows the manager to sign out and enter the local fixture again", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await page
    .getByRole("button", { name: "Open Paulo Faulstich's menu" })
    .click();
  const profileMenu = page.getByRole("menu", { name: "User profile" });
  await expect(profileMenu).toBeVisible();
  await profileMenu.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill("manager@example.test");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Overview" }),
  ).toBeVisible();
});

test("marks Sessions as permanent operational navigation", async ({ page }) => {
  await page.route("**/api/v1/sessions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.route("**/api/v1/assignment-units", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });
  await page.goto("/sessions?status=pending_review&period=2026-08");

  const operation = page.getByRole("navigation", { name: "Operations" });
  await expect(
    operation.getByRole("link", { name: "Sessions" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    operation.getByRole("link", { name: "Overview" }),
  ).toHaveAttribute("href", "/dashboard");
  const appHeader = page.getByRole("banner");
  await expect(appHeader).toContainText("Parkview Residences");
  await expect(
    appHeader.getByLabel("Administrator Paulo Faulstich"),
  ).toBeVisible();
  expect(
    await page.getByRole("heading", { name: "Sessions", exact: true }).evaluate(
      (heading) => Number.parseFloat(getComputedStyle(heading).fontSize),
    ),
  ).toBeLessThanOrEqual(42);
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toContainText("Operations");
  await expect(breadcrumb).toContainText("Sessions");
  await expect(
    page.getByText(
      "Each session records its start, duration, energy consumed and the unit responsible for the cost.",
    ),
  ).toBeVisible();
});

test("redirects an unauthenticated Supabase session to login", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-ev-auth-test": "missing" });
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});

test("does not expose routes that merely share the login prefix", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-ev-auth-test": "missing" });
  await page.goto("/login-preview");

  await expect(page).toHaveURL(/\/login$/);
});

test("keeps data sources visibly scoped under settings on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/data-sources");

  const settingsNavigation = page.getByRole("navigation", {
    name: "Settings",
  });
  await expect(settingsNavigation.getByText("Settings")).toBeVisible();
  await expect(
    settingsNavigation.getByRole("link", { name: "Data sources" }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(
    "Parkview Residences",
  );
  await expect(
    page.getByRole("banner").getByLabel("Administrator Paulo Faulstich"),
  ).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toContainText("Settings");
  await expect(breadcrumb).toContainText("Data sources");
  await expect(
    page.getByText(
      "Bring in the sessions exported from SEMS+ and follow how they enter ChargeOps.",
    ),
  ).toBeVisible();
});

test("keeps the data sources title at the operational scale", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1640, height: 900 });
  await page.goto("/settings/data-sources");

  expect(
    await page.getByRole("heading", { name: "Data sources" }).evaluate(
      (heading) => Number.parseFloat(getComputedStyle(heading).fontSize),
    ),
  ).toBeLessThanOrEqual(42);
});

test("keeps breadcrumb-to-title spacing consistent across operational pages", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const dashboardGap = await breadcrumbTitleGap(page);

  await page.goto("/sessions?status=pending_review&period=2026-08");
  const recargasGap = await breadcrumbTitleGap(page);

  await page.goto("/settings/data-sources");
  const dataSourcesGap = await breadcrumbTitleGap(page);

  expect(Math.max(dashboardGap, recargasGap, dataSourcesGap)).toBeCloseTo(
    Math.min(dashboardGap, recargasGap, dataSourcesGap),
    0,
  );
});
