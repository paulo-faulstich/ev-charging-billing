import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  "../api/tests/fixtures/sems_sessions.csv",
);

test.describe.configure({ mode: "serial" });

test("shows an empty import history before any write", async ({ page }) => {
  await page.goto("/settings/data-sources");

  await expect(
    page.getByRole("heading", { name: "Import history" }),
  ).toBeVisible();
  await expect(page.getByText("No batches imported yet.")).toBeVisible();
});

test("shows a recoverable import-history error", async ({ page }) => {
  await page.route("**/api/v1/import-batches", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 503, body: "temporarily unavailable" });
      return;
    }
    await route.continue();
  });

  await page.goto("/settings/data-sources");

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "The history did not load. Try again." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh history" }),
  ).toBeVisible();
});

test("orders import history from newest to oldest", async ({ page }) => {
  await page.route("**/api/v1/import-batches", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "70000000-0000-0000-0000-000000000001",
            filename: "oldest.csv",
            checksum: "oldest",
            source: "sems_csv",
            status: "completed",
            created: true,
            totalCount: 1,
            validCount: 1,
            invalidCount: 0,
            duplicateCount: 0,
            createdAt: "2026-08-28T12:00:00Z",
          },
          {
            id: "70000000-0000-0000-0000-000000000002",
            filename: "newest.csv",
            checksum: "newest",
            source: "sems_csv",
            status: "completed",
            created: true,
            totalCount: 3,
            validCount: 1,
            invalidCount: 1,
            duplicateCount: 1,
            createdAt: "2026-08-29T12:00:00Z",
          },
        ],
      }),
    });
  });

  await page.goto("/settings/data-sources");

  const historyRows = page
    .getByRole("table", { name: "Import history" })
    .locator("tbody tr");
  await expect(historyRows).toHaveCount(2);
  await expect(historyRows.nth(0)).toContainText("newest.csv");
  await expect(historyRows.nth(0)).toContainText(
    "3 total · 1 valid · 1 invalid · 1 duplicate",
  );
  await expect(historyRows.nth(1)).toContainText("oldest.csv");
  await expect(historyRows.nth(1)).toContainText(
    "1 total · 1 valid · 0 invalid · 0 duplicates",
  );
});

test("keeps confirmation errors recoverable without losing the preview", async ({
  page,
}) => {
  await page.goto("/settings/data-sources");
  await page.getByLabel("SEMS+ CSV file").setInputFiles(FIXTURE_PATH);
  await page.getByRole("button", { name: "Analyse file" }).click();

  await page.route("**/api/v1/import-batches", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 503, body: "temporarily unavailable" });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Confirm import" }).click();

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "The import did not finish. Try again." }),
  ).toBeVisible();
  await expect(page.getByText("No records were saved")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm import" }),
  ).toBeEnabled();
});

test("confirms a SEMS batch and shows idempotent descending history", async ({
  page,
}) => {
  await page.goto("/settings/data-sources");
  await page.getByLabel("SEMS+ CSV file").setInputFiles(FIXTURE_PATH);
  await page.getByRole("button", { name: "Analyse file" }).click();

  await expect(page.getByText("2 valid", { exact: true })).toBeVisible();
  await expect(page.getByText("No records were saved")).toBeVisible();
  await expect(page.getByText("No batches imported yet.")).toBeVisible();

  const creationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/import-batches"),
  );
  await page.getByRole("button", { name: "Confirm import" }).click();
  expect((await creationResponse).status()).toBe(201);

  await expect(
    page.getByText("Import complete", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 sessions added")).toBeVisible();
  await expect(page.getByText("August 2026", { exact: true })).toBeVisible();
  await expect(
    page.getByText("0 invalid · 0 duplicates", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue closing" }),
  ).toHaveAttribute("href", "/dashboard");
  await expect(
    page.getByRole("button", { name: "Import another file" }),
  ).toBeVisible();
  await expect(page.getByText("Confirmation required")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Import again" }),
  ).toBeHidden();
  const history = page.getByRole("table", {
    name: "Import history",
  });
  await expect(
    history.getByRole("row", { name: /sems_sessions\.csv.*Completed/ }),
  ).toBeVisible();
  await expect(history.getByText("SEMS+ CSV")).toBeVisible();
  await expect(page.getByText("1 batch", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const replayResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/import-batches"),
  );
  await page.getByRole("button", { name: "Import another file" }).click();
  await expect(page.getByLabel("SEMS+ CSV file")).toBeVisible();
  await page.getByLabel("SEMS+ CSV file").setInputFiles(FIXTURE_PATH);
  await page.getByRole("button", { name: "Analyse file" }).click();
  await page.getByRole("button", { name: "Confirm import" }).click();
  expect((await replayResponse).status()).toBe(200);

  await expect(
    page.getByText("Batch already exists; no session duplicated"),
  ).toBeVisible();
  await expect(page.getByText("1 batch", { exact: true })).toBeVisible();
  await expect(
    history.getByRole("row", { name: /sems_sessions\.csv.*Completed/ }),
  ).toHaveCount(1);
});

test("ignores a stale initial history response after confirmation", async ({
  page,
}) => {
  let releaseInitialHistory: () => void = () => undefined;
  let markInitialHistoryRequested: () => void = () => undefined;
  const initialHistoryGate = new Promise<void>((resolve) => {
    releaseInitialHistory = resolve;
  });
  const initialHistoryRequested = new Promise<void>((resolve) => {
    markInitialHistoryRequested = resolve;
  });
  let delayedHistoryCount = 0;
  let confirmationStarted = false;

  await page.route("**/api/v1/import-batches", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    if (confirmationStarted) {
      await route.continue();
      return;
    }

    delayedHistoryCount += 1;
    const delayedHistoryId = delayedHistoryCount.toString();
    markInitialHistoryRequested();
    await initialHistoryGate;
    await route.fulfill({
      contentType: "application/json",
      headers: { "x-test-delayed-history": delayedHistoryId },
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto("/settings/data-sources");
  await initialHistoryRequested;

  const fixture = await readFile(FIXTURE_PATH, "utf8");
  await page.getByLabel("SEMS+ CSV file").setInputFiles({
    name: "sems_race.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(fixture.replaceAll("29/08/2026", "30/08/2026")),
  });
  await page.getByRole("button", { name: "Analyse file" }).click();
  confirmationStarted = true;
  const creationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/import-batches"),
  );
  await page.getByRole("button", { name: "Confirm import" }).click();
  expect((await creationResponse).status()).toBe(201);

  const newBatchRow = page
    .getByRole("table", { name: "Import history" })
    .getByRole("row", { name: /sems_race\.csv.*Completed/ });
  await expect(newBatchRow).toBeVisible();

  const delayedResponses = Array.from(
    { length: delayedHistoryCount },
    (_, index) =>
      page.waitForResponse(
        (response) =>
          response.headers()["x-test-delayed-history"] ===
          (index + 1).toString(),
      ),
  );
  releaseInitialHistory();
  const completedDelayedResponses = await Promise.all(delayedResponses);
  await Promise.all(
    completedDelayedResponses.map((response) => response.finished()),
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

  await expect(newBatchRow).toBeVisible();
  await expect(page.getByText("No batches imported yet.")).toBeHidden();
});

test("hands a confirmed SEMS import to the manager action queue", async ({
  page,
}) => {
  const fixture = await readFile(FIXTURE_PATH, "utf8");

  await page.goto("/settings/data-sources");
  await page.getByLabel("SEMS+ CSV file").setInputFiles({
    name: "sems_monthly_close.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(fixture.replaceAll("29/08/2026", "29/09/2026")),
  });
  await page.getByRole("button", { name: "Analyse file" }).click();
  const confirmationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/import-batches"),
  );
  await page.getByRole("button", { name: "Confirm import" }).click();
  const confirmed = await confirmationResponse;
  expect(confirmed.status(), await confirmed.text()).toBe(201);

  await expect(page.getByText("2 sessions added")).toBeVisible();
  await page.getByRole("link", { name: "Continue closing" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  // This test drives the real API, so the dashboard may hold several months
  // and render a picker instead of plain text. The chart caption names the
  // selected period in either shape.
  await expect(page.getByText("kWh · September 2026")).toBeVisible();
  await expect(page.getByText("0 of 2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Review 2 pending items" }).click();

  await expect(page).toHaveURL(
    /\/sessions\?status=pending_review&period=2026-09$/,
  );
  await page
    .getByLabel("Responsible unit")
    .selectOption({ label: "Unit A-101" });
  await page
    .getByLabel("Justification")
    .fill("Responsible unit confirmed by the administrator");
  await page
    .getByRole("button", { name: "Assign and review next" })
    .click();

  await expect(page.getByRole("status")).toContainText("Unit A-101");
  await expect(page.getByText("1 pending item in the period")).toBeVisible();
});
