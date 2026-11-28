"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  confirmImport,
  listImportBatches,
  previewImport,
  type ImportBatchResponse,
  type ImportPreviewResponse,
} from "@ev-chargeops/api-client";

import { ImportHistory } from "./import-history";
import { PreviewSummary } from "./preview-summary";
import { PreviewTable } from "./preview-table";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const periodFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function previewPeriod(preview: ImportPreviewResponse): string {
  const sessionDates = preview.records.flatMap((record) => {
    if (!record.session) return [];
    const date = new Date(record.session.startedAt);
    return Number.isNaN(date.getTime()) ? [] : [date];
  });
  if (sessionDates.length === 0) return "Period not identified";

  const latest = sessionDates.reduce((current, date) =>
    date > current ? date : current,
  );
  return periodFormatter.format(latest);
}

export function ImportDropzone({ accessToken }: { accessToken: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ImportBatchResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState(false);
  const [batches, setBatches] = useState<ImportBatchResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const historyRequestGeneration = useRef(0);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    const generation = ++historyRequestGeneration.current;
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const response = await listImportBatches(accessToken, apiUrl);
      if (generation !== historyRequestGeneration.current) return;
      setBatches(response.items);
    } catch {
      if (generation !== historyRequestGeneration.current) return;
      setHistoryError(true);
    } finally {
      if (generation !== historyRequestGeneration.current) return;
      setHistoryLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const generation = ++historyRequestGeneration.current;

    void listImportBatches(accessToken, apiUrl)
      .then((response) => {
        if (generation !== historyRequestGeneration.current) return;
        setBatches(response.items);
      })
      .catch(() => {
        if (generation !== historyRequestGeneration.current) return;
        setHistoryError(true);
      })
      .finally(() => {
        if (generation !== historyRequestGeneration.current) return;
        setHistoryLoading(false);
      });

    return () => {
      historyRequestGeneration.current += 1;
    };
  }, [accessToken]);

  function selectFile(selectedFile: File | null) {
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Select a CSV file exported from SEMS+.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setConfirmation(null);
    setConfirmationError(false);
    setError(null);
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (loading) return;

    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = loading ? "none" : "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (loading) return;

    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (loading) return;

    if (fileInputRef.current) fileInputRef.current.value = "";
    selectFile(event.dataTransfer.files.item(0));
  }

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      setPreview(await previewImport(file, accessToken, apiUrl));
    } catch {
      setError("The analysis did not finish. Check that the file is a CSV exported from SEMS+ and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!file) return;

    setConfirming(true);
    setConfirmationError(false);

    try {
      const result = await confirmImport(file, accessToken, apiUrl);
      setConfirmation(result);
      await loadHistory();
    } catch {
      setConfirmationError(true);
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setConfirmation(null);
    setConfirmationError(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (preview) {
    return (
      <div className="data-source-workflow">
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-[14px] bg-[var(--accent-soft)] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[0.78rem] font-semibold text-[var(--muted)]">Preview complete</p>
              <p className="mt-2 text-sm text-[var(--ink)]">{preview.filename}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {confirmation
                  ? "Batch recorded in the operational history."
                  : "No records were saved."}
              </p>
            </div>
            {!confirmation ? (
              <button type="button" onClick={reset} className="rounded-xl border border-[var(--line-strong)] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white">
                Review another file
              </button>
            ) : null}
          </div>
          <PreviewSummary preview={preview} />
          <PreviewTable preview={preview} />

          {confirmation ? (
            <section className="import-success-panel" aria-labelledby="import-success-title">
              <div>
                <p className="utility-label">Import complete</p>
                <h2 id="import-success-title">
                  {confirmation.created
                    ? `${confirmation.validCount} ${confirmation.validCount === 1 ? "session" : "sessions"} added`
                    : "Batch already exists; no session duplicated"}
                </h2>
                <p className="import-success-period">{previewPeriod(preview)}</p>
                <p>
                  {confirmation.invalidCount} invalid · {confirmation.duplicateCount} duplicates
                </p>
              </div>
              <div className="import-success-actions">
                <Link href="/dashboard" className="primary-dashboard-action compact">
                  Continue closing
                </Link>
                <button type="button" onClick={reset}>
                  Import another file
                </button>
              </div>
            </section>
          ) : (
            <div className="confirmation-panel">
              <div>
                <p className="utility-label">Confirmation required</p>
                <p>
                  The preview saves nothing. Confirm to create the batch and
                  the valid sessions in the operational history.
                </p>
              </div>
              <button type="button" disabled={confirming} onClick={confirm}>
                {confirming ? "Confirming…" : "Confirm import"}
              </button>
            </div>
          )}
          {!confirmation && confirmationError ? (
            <div role="alert" className="confirmation-error">
              The import did not finish. Try again.
            </div>
          ) : null}
        </div>

        <ImportHistory
          batches={batches}
          error={historyError}
          loading={historyLoading}
          onRefresh={() => void loadHistory()}
        />
      </div>
    );
  }

  return (
    <div className="data-source-workflow">
      <section
        aria-labelledby="upload-title"
        className={`rounded-[20px] border p-5 backdrop-blur-xl transition-colors sm:p-8 lg:p-10 ${
          isDragging
            ? "border-solid border-[var(--cyan)] bg-white/80 ring-4 ring-[var(--accent-soft)] shadow-[0_18px_40px_-22px_rgba(40,58,92,0.45)]"
            : "border-dashed border-[var(--line-strong)] bg-[var(--panel)] shadow-[0_18px_40px_-22px_rgba(40,58,92,0.28)]"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
          <div>
          <p className="text-[0.78rem] font-semibold text-[var(--muted)]">Step 01 · data source</p>
          <h2 id="upload-title" className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Select the SEMS+ export</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">The analysis checks every row and shows its classification before any import batch is created.</p>

          <label htmlFor="sems-file" className="mt-7 block text-sm font-medium text-[var(--ink)]">SEMS+ CSV file</label>
          <p id="upload-guidance" className={`mt-2 text-sm ${isDragging ? "font-medium text-[var(--cyan)]" : "text-[var(--muted)]"}`}>
            {isDragging ? "Drop the CSV to select it" : "Drag and drop the CSV onto this panel or use the picker below."}
          </p>
          <input
            id="sems-file"
            ref={fileInputRef}
            aria-describedby="upload-guidance"
            className="mt-3 block w-full max-w-2xl cursor-pointer rounded-xl border border-[var(--line-strong)] bg-white/75 px-3 py-2 text-sm text-[var(--ink-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--navy)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            type="file"
            accept=".csv,text/csv"
            disabled={loading}
            onChange={(event) => {
              selectFile(event.target.files?.[0] ?? null);
            }}
          />
          {file ? <p className="mt-3 text-xs text-[var(--cyan)]">Selected: {file.name}</p> : <p className="mt-3 text-sm text-[var(--muted)]">No file selected.</p>}
          </div>

          <aside className="border-l border-[var(--line)] pl-5 text-sm leading-6 text-[var(--ink-2)]">
            <p className="text-[0.78rem] font-semibold text-[var(--muted)]">What you will see</p>
            <p className="mt-2">Status per row, energy, charger and provenance signals.</p>
          </aside>
        </div>

        {loading ? <p role="status" className="mt-6 rounded-[14px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--cyan)]">Reading and classifying the sessions…</p> : null}
        {error ? <div role="alert" className="mt-6 rounded-[14px] bg-[var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--coral)]">{error}</div> : null}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button type="button" disabled={!file || loading} onClick={analyze} className="rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_20px_-12px_rgba(30,39,66,0.85)] transition-colors hover:bg-[#2b3658] disabled:cursor-not-allowed disabled:opacity-45">
            {loading ? "Analysing…" : "Analyse file"}
          </button>
          {error && file ? <button type="button" onClick={analyze} className="rounded-xl border border-[var(--line-strong)] bg-white/70 px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-white">Try again</button> : null}
        </div>
      </section>

      <ImportHistory
        batches={batches}
        error={historyError}
        loading={historyLoading}
        onRefresh={() => void loadHistory()}
      />
    </div>
  );
}
