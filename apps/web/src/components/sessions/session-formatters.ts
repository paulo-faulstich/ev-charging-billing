const sessionDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Sao_Paulo",
});

// Dates and times follow US conventions, like the amounts on the invoices.
const queueDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Sao_Paulo",
});

const energyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const periodFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatSessionDate(value: string): string {
  return sessionDateFormatter.format(new Date(value));
}

export function formatQueueDate(value: string): string {
  return queueDateFormatter.format(new Date(value));
}

export function formatSessionDuration(startedAt: string, endedAt: string): string {
  const durationMinutes = Math.max(
    0,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
    ),
  );
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export function formatSessionEnergy(value: string): string {
  return `${energyFormatter.format(Number(value))} kWh`;
}

export function formatSessionPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const label = periodFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
