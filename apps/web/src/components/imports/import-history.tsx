import type { ImportBatchResponse } from "@ev-chargeops/api-client";
import { importStatusLabel, sourceLabel } from "@/lib/vocabulary";

type ImportHistoryProps = {
  batches: ImportBatchResponse[];
  error: boolean;
  loading: boolean;
  onRefresh: () => void;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function countedLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ImportHistory({
  batches,
  error,
  loading,
  onRefresh,
}: ImportHistoryProps) {
  const orderedBatches = [...batches].sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      right.id.localeCompare(left.id),
  );

  return (
    <section className="import-history" aria-labelledby="import-history-title">
      <div className="import-history-heading">
        <div>
          <p className="utility-label">Provenance record</p>
          <h2 id="import-history-title">Import history</h2>
        </div>
        <p className="history-count">
          {batches.length} {batches.length === 1 ? "batch" : "batches"}
        </p>
      </div>

      {loading ? (
        <p aria-live="polite" className="history-state">
          Updating history…
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="history-state history-error">
          <p>The history did not load. Try again.</p>
          <button type="button" onClick={onRefresh}>
            Refresh history
          </button>
        </div>
      ) : null}

      {!loading && !error && orderedBatches.length === 0 ? (
        <div className="history-empty">
          <span aria-hidden="true" />
          <div>
            <p>No batches imported yet.</p>
            <p>The first confirmation will appear here with its source and totals.</p>
          </div>
        </div>
      ) : null}

      {!loading && !error && orderedBatches.length > 0 ? (
        <div className="history-table-frame">
          <table aria-label="Import history">
            <thead>
              <tr>
                <th>File</th>
                <th>Source</th>
                <th>Imported at</th>
                <th>Result</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orderedBatches.map((batch) => (
                <tr key={batch.id}>
                  <td className="history-filename">{batch.filename}</td>
                  <td>{sourceLabel(batch.source)}</td>
                  <td>{dateFormatter.format(new Date(batch.createdAt))}</td>
                  <td>
                    {batch.totalCount} total · {countedLabel(
                      batch.validCount,
                      "valid",
                      "valid",
                    )} · {countedLabel(
                      batch.invalidCount,
                      "invalid",
                      "invalid",
                    )} · {countedLabel(
                      batch.duplicateCount,
                      "duplicate",
                      "duplicates",
                    )}
                  </td>
                  <td>
                    <span className="history-status">
                      {importStatusLabel(batch.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
