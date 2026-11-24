import { expect, test, type Page } from "@playwright/test";
import type { SessionResponse } from "@ev-chargeops/api-client";

const unknownSessions: { items: SessionResponse[] } = {
  items: [
    {
      id: "90000000-0000-0000-0000-000000000001",
      startedAt: "2026-08-29T20:10:00Z",
      endedAt: "2026-08-29T21:10:00Z",
      energyKwh: "7.000",
      chargerSerial: "STN00DEMO0000001",
      source: "sems_export",
      provenance: "real",
      identityConfidence: "unknown",
      status: "pending_review",
      unitId: null,
      unitCode: null,
      unitName: null,
      residentName: null,
      assignmentOrigin: null,
    },
    {
      id: "90000000-0000-0000-0000-000000000002",
      startedAt: "2026-08-29T21:30:00Z",
      endedAt: "2026-08-29T22:00:00Z",
      energyKwh: "3.500",
      chargerSerial: "STN00DEMO0000001",
      source: "sems_export",
      provenance: "real",
      identityConfidence: "unknown",
      status: "pending_review",
      unitId: null,
      unitCode: null,
      unitName: null,
      residentName: null,
      assignmentOrigin: null,
    },
  ],
};

async function routeDashboardSessions(
  page: Page,
  items: SessionResponse[],
) {
  await page.route("**/api/v1/sessions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });
}

test("guides a first-time manager to import SEMS sessions", async ({ page }) => {
  await routeDashboardSessions(page, []);
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb).toContainText("Operations");
  await expect(breadcrumb).toContainText("Overview");
  await expect(
    page.getByText(
      "Track consumption, costs and pending items before the month closes.",
    ),
  ).toBeVisible();
  await expect(page.getByText("No data imported")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Import SEMS+ data" }),
  ).toHaveAttribute("href", "/settings/data-sources");
  await expect(page.getByText("Import sessions", { exact: true })).toBeVisible();
  await expect(page.getByText("Review assignments", { exact: true })).toBeVisible();
  await expect(
    page.getByText("AI analyses the closing", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("The administrator approves", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(
    "Parkview Residences",
  );
  await expect(
    page.getByLabel("Administrator Paulo Faulstich"),
  ).toBeVisible();
  expect(
    await page.getByRole("heading", { name: "Overview" }).evaluate(
      (heading) => Number.parseFloat(getComputedStyle(heading).fontSize),
    ),
  ).toBeLessThanOrEqual(42);

  await page.setViewportSize({ width: 1440, height: 500 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole("banner")).toBeInViewport();
  await expect(
    page.getByRole("banner").getByLabel("Administrator Paulo Faulstich"),
  ).toBeInViewport();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("uses the available operational workspace width", async ({ page }) => {
  await page.setViewportSize({ width: 1640, height: 900 });
  await routeDashboardSessions(page, []);
  await page.goto("/dashboard");

  const overviewBox = await page.locator(".dashboard-overview").boundingBox();
  expect(overviewBox?.width).toBeGreaterThanOrEqual(1240);
});

test("aligns every closing marker to its timeline column", async ({ page }) => {
  await page.setViewportSize({ width: 1640, height: 900 });
  await routeDashboardSessions(page, []);
  await page.goto("/dashboard");

  const progress = page.locator(".close-steps");
  const progressBox = await progress.boundingBox();
  const nodeBoxes = await progress.locator(".close-step-node").evaluateAll(
    (nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, width: box.width };
      }),
  );
  expect(progressBox).not.toBeNull();
  nodeBoxes.forEach((node, index) => {
    const expectedCenter =
      progressBox!.x + ((index + 0.5) * progressBox!.width) / 4;
    const nodeCenter = node.x + node.width / 2;
    expect(Math.abs(nodeCenter - expectedCenter)).toBeLessThanOrEqual(2);
  });
});

test("keeps the closing explanation visible when session data is unavailable", async ({
  page,
}) => {
  await page.route("**/api/v1/sessions**", async (route) => {
    await route.fulfill({ status: 503, body: "temporarily unavailable" });
  });
  await page.goto("/dashboard");

  await expect(page.getByText("Session service unavailable")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What happens next" }),
  ).toBeVisible();
  await expect(
    page.getByText("AI analyses the closing", { exact: true }),
  ).toBeVisible();
});

test("uses canonical unknown assignments for the monthly blocker", async ({
  page,
}) => {
  await routeDashboardSessions(page, unknownSessions.items);
  await page.goto("/dashboard");

  await expect(page.getByText("August 2026", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Period indicators").getByText("10,50 kWh", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("0 of 2", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "2 sessions cannot be billed yet because the responsible unit has not been identified.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review 2 pending items" }),
  ).toHaveAttribute(
    "href",
    "/sessions?status=pending_review&period=2026-08",
  );
  await expect(
    page.getByRole("link", { name: "Go to the closing" }),
  ).toBeVisible();
});

test("groups assigned costs by condominium unit, never charger identity", async ({
  page,
}) => {
  await routeDashboardSessions(page, [
    {
      ...unknownSessions.items[0],
      identityConfidence: "assigned",
      status: "ready",
      unitId: "40000000-0000-0000-0000-000000000001",
      unitCode: "A-101",
      unitName: "Unit A-101",
      residentName: "Ana Oliveira",
      assignmentOrigin: null,
    },
    unknownSessions.items[1],
  ]);
  await page.goto("/closing");

  const costs = page.getByRole("table", { name: "Consumption by responsible unit" });
  await expect(costs).toContainText("Unit A-101");
  await expect(costs).not.toContainText("STN00DEMO0000001");
});
