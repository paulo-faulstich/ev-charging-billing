import type { ImportPreviewResponse } from "@ev-chargeops/api-client";

export function PreviewSummary({ preview }: { preview: ImportPreviewResponse }) {
  const cards = [
    [preview.totalCount, "records", "Rows read from the file"],
    [preview.validCount, "valid", "Ready to import"],
    [preview.invalidCount, "invalid", "Need fixing in the file"],
    [preview.duplicateCount, "duplicates", "Imported before; not added again"],
  ] as const;

  return (
    <section aria-label="Analysis summary" className="grid gap-px overflow-hidden border border-[#213849] bg-[#213849] sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([value, label, detail]) => (
        <div key={label} className="bg-[#0b1b28] px-5 py-5 sm:px-6">
          <p className="font-mono text-3xl font-semibold tracking-[-0.06em] text-white">
            {value} <span className="text-sm font-normal tracking-normal text-[#c2d2dc]">{label}</span>
          </p>
          <p className="mt-2 text-sm text-[#90a7b8]">{detail}</p>
        </div>
      ))}
    </section>
  );
}
