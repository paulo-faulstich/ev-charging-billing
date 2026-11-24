/** The words the screen uses for values the API stores as codes.
 *
 * The rule for where a name lives: if the invoice document says it, the API
 * owns the wording, so the PDF and the screen cannot drift apart. If only a
 * screen ever shows it — a finding, a severity, where a charge came from — the
 * name lives here. Every lookup falls back to the raw value, because an
 * unlabelled code on screen is bad and a blank cell is worse.
 */

const FINDING_TITLES: Record<string, string> = {
  INVALID_INTERVAL: "Session ends before it starts",
  NON_POSITIVE_ENERGY: "Session with no energy",
  POWER_EXCEEDS_RATED: "Power above what the charger delivers",
  DUPLICATE_SUSPECT: "Possible duplicate session",
  ENERGY_OUTLIER: "Consumption outside the unit's pattern",
  AGGREGATE_MISMATCH: "Difference against the charger total",
  AGGREGATE_RECONCILED: "Matches the charger total",
  UNASSIGNED_ENERGY: "Sessions with no responsible unit",
  DISTRIBUTION_INCONCLUSIVE: "Too few sessions to compare",
};

export function findingTitle(code: string): string {
  return FINDING_TITLES[code] ?? code;
}

/** Severities as they are counted: "2 critical · 1 warning". */
const SEVERITY_COUNT_LABELS: Record<string, string> = {
  critical: "critical",
  warning: "warnings",
  info: "notes",
};

export function severityCountLabel(severity: string): string {
  return SEVERITY_COUNT_LABELS[severity] ?? severity;
}

/** The same severities named one at a time. */
const SEVERITY_NAMES: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Informational",
};

export function severityName(severity: string): string {
  return SEVERITY_NAMES[severity] ?? severity;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "high",
  medium: "medium",
  low: "low",
  inconclusive: "inconclusive",
};

export function confidenceLabel(confidence: string): string {
  return CONFIDENCE_LABELS[confidence] ?? confidence;
}

/** Whether a charge was measured or made up. Never abbreviate this one. */
const PROVENANCE_LABELS: Record<string, string> = {
  real: "Real measurement",
  assigned: "Real measurement, unit assigned",
  simulated: "Simulated data",
  derived: "Derived value",
  external: "External source",
};

export function provenanceLabel(provenance: string): string {
  return PROVENANCE_LABELS[provenance] ?? provenance;
}

const SOURCE_LABELS: Record<string, string> = {
  // "SEMS+ CSV" is what the manager exported from GoodWe's own portal, so the
  // import history, the data source and a charge's row all call it that.
  sems_export: "SEMS+ CSV",
  sems_csv: "SEMS+ CSV",
  manual: "Manual entry",
  simulated: "Demo generator",
  goodwe_api: "GoodWe API",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

const IMPORT_STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  pending: "In progress",
  failed: "Failed",
};

export function importStatusLabel(status: string): string {
  return IMPORT_STATUS_LABELS[status] ?? status;
}
