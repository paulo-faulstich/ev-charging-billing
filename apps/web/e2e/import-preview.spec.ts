import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

test("permanently redirects the legacy import route to data-source settings", async ({
  request,
}) => {
  const response = await request.get("/imports/new", { maxRedirects: 0 });

  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/settings/data-sources");
});

/**
 * A preview is checked against what the database already holds, so a session
 * another spec confirmed earlier comes back as a duplicate rather than valid.
 * These tests state a clean two-valid preview, so they bring their own day.
 */
const FIXTURE_DAY = "29/08/2026";
const PREVIEW_DAY = "11/11/2026";
const DROP_DAY = "12/11/2026";

async function uniqueFixture(day: string): Promise<string> {
  const contents = await readFile(
    path.resolve(process.cwd(), "../api/tests/fixtures/sems_sessions.csv"),
    "utf8",
  );
  return contents.replaceAll(FIXTURE_DAY, day);
}

test("previews a SEMS export with explicit provenance", async ({ page }) => {
  await page.goto("/imports/new");
  await page.getByLabel("SEMS+ CSV file").setInputFiles({
    name: "sems_sessions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(await uniqueFixture(PREVIEW_DAY)),
  });
  await page.getByRole("button", { name: "Analyse file" }).click();

  // Scoped to the analysis panel: the import history repeats the same counts,
  // so an unscoped match depends on what earlier tests happened to import.
  const summary = page.getByLabel("Analysis summary");
  await expect(summary.getByText("2 records")).toBeVisible();
  await expect(summary.getByText("2 valid")).toBeVisible();
  await expect(summary.getByText("0 invalid")).toBeVisible();
  await expect(summary.getByText("0 duplicates")).toBeVisible();
  await expect(page.getByText("Real source").first()).toBeVisible();
  await expect(page.getByText("Unknown identity").first()).toBeVisible();
});

test("selects and previews a SEMS export dropped on the upload panel", async ({ page }) => {
  const fixtureContents = await uniqueFixture(DROP_DAY);

  await page.goto("/imports/new");

  const uploadPanel = page.getByRole("region", { name: "Select the SEMS+ export" });
  const dataTransfer = await page.evaluateHandle(
    ({ contents }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([contents], "sems_sessions.csv", { type: "text/csv" }));
      return transfer;
    },
    { contents: fixtureContents },
  );

  await uploadPanel.dispatchEvent("dragenter", { dataTransfer });
  const dragoverWasCancelled = await uploadPanel.evaluate((element) => {
    const event = new DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(dragoverWasCancelled).toBe(true);
  await expect(page.getByText("Drop the CSV to select it")).toBeVisible();
  await expect(uploadPanel).not.toHaveCSS("box-shadow", "none");

  const title = page.getByRole("heading", { name: "Select the SEMS+ export" });
  await title.dispatchEvent("dragenter", { dataTransfer });
  await title.dispatchEvent("dragleave", { dataTransfer });
  await expect(page.getByText("Drop the CSV to select it")).toBeVisible();

  await uploadPanel.dispatchEvent("drop", { dataTransfer });

  await expect(page.getByText("Selected: sems_sessions.csv")).toBeVisible();
  await page.getByRole("button", { name: "Analyse file" }).click();

  const dropped = page.getByLabel("Analysis summary");
  await expect(dropped.getByText("2 records")).toBeVisible();
  await expect(dropped.getByText("2 valid")).toBeVisible();
});

test("rejects a non-CSV file dropped on the upload panel", async ({ page }) => {
  await page.goto("/imports/new");

  const uploadPanel = page.getByRole("region", { name: "Select the SEMS+ export" });
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["not a SEMS export"], "sessions.txt", { type: "text/plain" }));
    return transfer;
  });

  await uploadPanel.dispatchEvent("drop", { dataTransfer });

  await expect(uploadPanel.getByRole("alert")).toContainText("Select a CSV file");
  await expect(page.getByRole("button", { name: "Analyse file" })).toBeDisabled();
});

test("clears a non-CSV file rejected through the native picker", async ({ page }) => {
  await page.goto("/imports/new");

  const fileInput = page.getByLabel("SEMS+ CSV file");
  await fileInput.setInputFiles({
    name: "sessions.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a SEMS export"),
  });

  await expect(page.getByRole("region", { name: "Select the SEMS+ export" }).getByRole("alert")).toContainText("Select a CSV file");
  await expect(fileInput).toHaveValue("");
  await expect(page.getByRole("button", { name: "Analyse file" })).toBeDisabled();
});
