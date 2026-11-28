import type { ImportPreviewResponse } from "@ev-chargeops/api-client";

export function PreviewSummary({ preview }: { preview: ImportPreviewResponse }) {
  const cards = [
    [preview.totalCount, "records", "Rows read from the file"],
    [preview.validCount, "valid", "Ready to import"],
    [preview.invalidCount, "invalid", "Need fixing in the file"],
    [preview.duplicateCount, "duplicates", "Imported before; not added again"],
  ] as const;

  return (
    <section aria-label="Analysis summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([value, label, detail]) => (
        <div key={label} className="rounded-[20px] border border-white/75 bg-[var(--panel)] px-5 py-5 shadow-[0_18px_40px_-22px_rgba(40,58,92,0.28)] backdrop-blur-xl sm:px-6">
          <p className="text-3xl font-semibold tracking-[-0.06em] text-[var(--ink)]">
            {value} <span className="text-sm font-normal tracking-normal text-[var(--ink-2)]">{label}</span>
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">{detail}</p>
        </div>
      ))}
    </section>
  );
}
