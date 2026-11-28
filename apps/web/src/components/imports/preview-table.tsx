import type { ImportPreviewResponse } from "@ev-chargeops/api-client";

function statusLabel(classification: string) {
  const labels: Record<string, string> = {
    valid: "Valid",
    invalid: "Invalid",
    duplicate: "Already imported",
  };

  return labels[classification] ?? classification;
}

function statusClass(classification: string) {
  if (classification === "valid") return "border-transparent bg-[var(--ok-soft)] text-[var(--ok)]";
  if (classification === "duplicate") return "border-transparent bg-[var(--warn-soft)] text-[var(--amber-deep)]";
  return "border-transparent bg-[var(--danger-soft)] text-[var(--coral)]";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function PreviewTable({ preview }: { preview: ImportPreviewResponse }) {
  return (
    <section aria-labelledby="ledger-title" className="overflow-hidden rounded-[20px] border border-white/75 bg-[var(--panel)] shadow-[0_18px_40px_-22px_rgba(40,58,92,0.28)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] px-5 py-5 sm:px-6">
        <div>
          <p className="text-[0.78rem] font-semibold text-[var(--muted)]">Classification ledger</p>
          <h2 id="ledger-title" className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[var(--ink)]">Sessions and provenance</h2>
        </div>
        <p className="max-w-sm text-sm leading-5 text-[var(--muted)]">The table keeps the source row so it is easy to check against the CSV.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="text-xs text-[var(--muted)]">
            <tr>
              {["Row", "Classification", "Energy", "Start", "Charger", "Evidence"].map((label) => (
                <th key={label} scope="col" className="px-5 py-3.5 font-medium sm:px-6">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {preview.records.map((record) => (
              <tr key={record.rowNumber} className="align-top transition-colors hover:bg-white/50">
                <td className="px-5 py-4 text-xs text-[var(--muted)] sm:px-6">{record.rowNumber}</td>
                <td className="px-5 py-4 sm:px-6">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(record.classification)}`}>
                    {statusLabel(record.classification)}
                  </span>
                  {record.errorMessage ? <p className="mt-2 max-w-56 leading-5 text-[var(--coral)]">{record.errorMessage}</p> : null}
                </td>
                <td className="px-5 py-4 text-[var(--ink)] sm:px-6">{record.session ? `${record.session.energyKwh} kWh` : "—"}</td>
                <td className="px-5 py-4 text-[var(--ink-2)] sm:px-6">{record.session ? formatDate(record.session.startedAt) : "—"}</td>
                <td className="px-5 py-4 text-xs text-[var(--ink-2)] sm:px-6">{record.session?.chargerSerial ?? "—"}</td>
                <td className="px-5 py-4 sm:px-6">
                  {record.session ? (
                    <div className="flex min-w-48 flex-col items-start gap-2">
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--cyan)]">Real source</span>
                      <span className="rounded-full bg-[var(--warn-soft)] px-2.5 py-1 text-xs font-medium text-[var(--amber-deep)]">Unknown identity</span>
                    </div>
                  ) : <span className="text-[var(--muted)]">Row not used</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
