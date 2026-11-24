"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  downloadInvoiceDocument,
  getInvoice,
  type InvoiceDetailResponse,
  type InvoiceItemResponse,
} from "@ev-chargeops/api-client";

import { useResidentContext } from "@/lib/billing/resident-context";
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

/** Money is printed from the stored integer cents, never from a float.
 *
 * The API sends the same integers the invoice was issued with and the PDF is
 * drawn from; formatting them here is the only transformation allowed, so the
 * screen and the document cannot disagree.
 */
function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const reais = Math.trunc(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  const grouped = reais.toLocaleString("pt-BR");
  return `${sign}R$ ${grouped},${String(rest).padStart(2, "0")}`;
}

function formatKwh(value: string): string {
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kWh`;
}

function formatRate(centsPerKwh: number): string {
  return `${formatCents(centsPerKwh)}/kWh`;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function dateTimeParts(iso: string, timeZone: string) {
  const value = new Date(iso);
  return {
    date: value.toLocaleDateString("pt-BR", { timeZone }),
    time: value.toLocaleTimeString("pt-BR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function duration(item: InvoiceItemResponse): string {
  const minutes = Math.floor(
    (Date.parse(item.endedAt) - Date.parse(item.startedAt)) / 60000,
  );
  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

type InvoiceState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; detail: InvoiceDetailResponse };

const LOADING: InvoiceState = { status: "loading" };

export function InvoiceView({
  invoiceId,
  accessToken,
  origin = "invoices",
}: {
  invoiceId: string;
  accessToken: string;
  /** Which list opened this invoice, so the way back leads there. */
  origin?: "invoices" | "closing";
}) {
  const { context: residentContext, enter } = useResidentContext();
  // The result is tagged with the request it answers, so switching invoice or
  // entering a resident context shows loading again without the effect having
  // to write state on its way in.
  const requestKey = `${invoiceId}:${residentContext?.id ?? ""}`;
  const [resolved, setResolved] = useState<{
    key: string;
    state: InvoiceState;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const state = resolved?.key === requestKey ? resolved.state : LOADING;

  useEffect(() => {
    let ignore = false;

    void getInvoice(invoiceId, accessToken, {
      baseUrl: apiUrl,
      residentContextId: residentContext?.id ?? null,
    })
      .then((detail) => {
        if (!ignore) {
          setResolved({ key: requestKey, state: { status: "ready", detail } });
        }
      })
      .catch((error: unknown) => {
        if (ignore) return;
        const message =
          error instanceof ApiError && error.status === 404
            ? "Invoice not found in this organisation."
            : "Could not load the invoice.";
        setResolved({ key: requestKey, state: { status: "error", message } });
      });

    return () => {
      ignore = true;
    };
  }, [invoiceId, accessToken, residentContext?.id, requestKey]);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await downloadInvoiceDocument(invoiceId, accessToken, {
        baseUrl: apiUrl,
        residentContextId: residentContext?.id ?? null,
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download =
        state.status === "ready"
          ? `${state.detail.invoice.number}.pdf`
          : "invoice.pdf";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // Revoking in the same tick can cancel the download the click just
      // started, so the URL is released once the browser has taken it.
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
    } finally {
      setDownloading(false);
    }
  }, [invoiceId, accessToken, residentContext?.id, state]);

  if (state.status === "loading") {
    return <p className="invoice-status">Loading invoice…</p>;
  }
  if (state.status === "error") {
    return <p className="invoice-status error">{state.message}</p>;
  }

  const { invoice, context, bands } = state.detail;
  const sum =
    invoice.energyValueCents + invoice.infraFeeCents + invoice.lossShareCents;
  const zone = context.timezone;
  const issued = dateTimeParts(invoice.issuedAt, zone);
  const appliedBands = new Set(invoice.items.map((item) => item.bandCode));
  // Only bands that would actually have cost less are worth showing; the rest
  // would be noise dressed as advice.
  const cheaper = bands
    .filter((band) => band.energyValueCents < invoice.energyValueCents)
    .sort((left, right) => left.energyValueCents - right.energyValueCents);
  const cheapest = cheaper[0];

  return (
    <div className="invoice-page">
      <header className="dashboard-heading invoice-heading">
        <div>
          <PageBreadcrumb
            section={origin === "closing" ? "Closing" : "Invoices"}
            current={`Invoice ${invoice.number}`}
          />
          <h1>
            Unit {invoice.unitCode} · {invoice.periodValue}
          </h1>
          <p>
            {invoice.unitName} · responsible {invoice.contactLabel} · issued on{" "}
            {issued.date}
          </p>
          <Link
            href={origin === "closing" ? "/closing" : "/invoices"}
            className="session-back-link"
          >
            <span aria-hidden="true">←</span>
            {origin === "closing"
              ? "Back to Closing"
              : "Back to Invoices"}
          </Link>
        </div>
        <div className="invoice-heading-actions">
          {residentContext === null ? (
            // The resident's view is this same page, scoped. Offering it here
            // means the manager never has to go looking for a second screen.
            <button
              type="button"
              className="invoice-secondary-action"
              onClick={() => void enter(invoice.unitId)}
            >
              View as the resident
            </button>
          ) : null}
          <button
            type="button"
            className="primary-dashboard-action compact"
            onClick={() => void download()}
            disabled={downloading}
          >
            {downloading ? "Generating PDF…" : "Download PDF"}
          </button>
        </div>
      </header>

      <section className="invoice-block" aria-labelledby="invoice-total-title">
        <div className="dashboard-section-heading">
          <h2 id="invoice-total-title">How much and why</h2>
          <span>Invoice {invoice.number}</span>
        </div>
        <p className="invoice-total">{formatCents(invoice.totalCents)}</p>
        <dl className="invoice-breakdown">
          <div>
            <dt>Energy consumed</dt>
            <dd>{formatCents(invoice.energyValueCents)}</dd>
          </div>
          <div>
            <dt>Infrastructure fee</dt>
            <dd>{formatCents(invoice.infraFeeCents)}</dd>
          </div>
          <div>
            <dt>Technical losses</dt>
            <dd>{formatCents(invoice.lossShareCents)}</dd>
          </div>
        </dl>
        <p className="invoice-sum-check">
          {formatCents(invoice.energyValueCents)} +{" "}
          {formatCents(invoice.infraFeeCents)} +{" "}
          {formatCents(invoice.lossShareCents)} = {formatCents(sum)}
        </p>
        {/* The comparison is worked out further down, but a reader who never
            scrolls that far is exactly the one it was written for. */}
        {cheapest !== undefined ? (
          <p className="invoice-advice-lead">
            Always charging <strong>{cheapest.hours}</strong> — the time band
            the electricity bill calls{" "}
            {cheapest.label.toLocaleLowerCase("en")} — this energy would cost{" "}
            <strong>
              {formatCents(invoice.energyValueCents - cheapest.energyValueCents)}
            </strong>{" "}
            less.{" "}
            <a href="#invoice-advice-title">See the comparison</a>
          </p>
        ) : null}
      </section>

      <section className="invoice-block" aria-labelledby="invoice-sessions-title">
        <div className="dashboard-section-heading">
          <h2 id="invoice-sessions-title">Where it came from</h2>
          <span>
            {invoice.items.length}{" "}
            {invoice.items.length === 1 ? "session" : "sessions"} ·{" "}
            {formatKwh(invoice.energyKwh)}
          </span>
        </div>
        {invoice.items.length === 0 ? (
          <p className="invoice-empty">
            No sessions in the period. With no consumption, nothing is billed.
          </p>
        ) : (
          <div className="responsible-table-frame">
            <table aria-label="Sessions on the invoice">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Duration</th>
                  <th>Energy</th>
                  <th>Time band</th>
                  <th>Tariff</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => {
                  const start = dateTimeParts(item.startedAt, zone);
                  const end = dateTimeParts(item.endedAt, zone);
                  return (
                    <tr key={item.id}>
                      <td>{start.date}</td>
                      <td>{start.time}</td>
                      <td>{end.time}</td>
                      <td>{duration(item)}</td>
                      <td>{formatKwh(item.energyKwh)}</td>
                      <td>{item.bandLabel}</td>
                      <td>{formatRate(item.rateCentsPerKwh)}</td>
                      <td>{formatCents(item.valueCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7}>Sum of the sessions</td>
                  <td>{formatCents(invoice.energyValueCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="invoice-note">
          Each row is rounded only once, when its own session is closed. The
          energy subtotal is the exact sum of the rows above.
        </p>
      </section>

      <section className="invoice-block" aria-labelledby="invoice-tariff-title">
        <div className="dashboard-section-heading">
          <h2 id="invoice-tariff-title">Why this tariff</h2>
          <span>{context.provenanceLabel}</span>
        </div>
        <dl className="invoice-tariff">
          <div>
            <dt>Tariff</dt>
            <dd>{context.tariffName}</dd>
          </div>
          <div>
            <dt>Set by</dt>
            <dd>{context.tariffSourceLabel}</dd>
          </div>
          <div>
            <dt>Valid</dt>
            <dd>
              {formatDate(context.tariffValidFrom)} to{" "}
              {context.tariffValidTo
                ? formatDate(context.tariffValidTo)
                : "in effect"}
            </dd>
          </div>
          <div>
            <dt>Allocation rule</dt>
            <dd>{context.policyName}</dd>
          </div>
          <div>
            <dt>Infrastructure fee</dt>
            <dd>{formatCents(context.infraFeeCents)} per active unit</dd>
          </div>
          <div>
            <dt>Technical losses</dt>
            <dd>
              {(context.lossBasisPoints / 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
              % of the energy
            </dd>
          </div>
        </dl>
        <ul className="tariff-bands">
          {bands.map((band) => (
            <li
              key={band.code}
              className={appliedBands.has(band.code) ? "applied" : undefined}
            >
              <strong>{band.label}</strong>
              <span className="tariff-band-hours">{band.hours}</span>
              <span>{formatRate(band.rateCentsPerKwh)}</span>
              {appliedBands.has(band.code) ? (
                <em>used on this invoice</em>
              ) : null}
            </li>
          ))}
        </ul>
        {/* The tariff has to explain itself here, on the invoice. Sending the
            reader somewhere else to find out how they were charged is the same
            as not telling them. */}
        <div className="tariff-explainer">
          <h3>How the bill is built</h3>
          <ol>
            <li>
              <strong>The energy.</strong> The session&apos;s energy is multiplied
              by the price of the time band in which it started. The three
              bands above are the same ones the utility uses on the building&apos;s
              electricity bill — peak is the early evening, when the grid is
              most loaded and energy costs more. A session that starts at 22:00
              pays the overnight price for all of it, even if it ends in the
              morning: the meter reports the session total, not minute by
              minute.
            </li>
            <li>
              <strong>The infrastructure fee.</strong>{" "}
              {formatCents(context.infraFeeCents)} per month, billed only to
              those who used the charger in the period. It is the fixed part:
              maintenance, availability and the equipment itself.
            </li>
            <li>
              <strong>The technical losses.</strong> Between the building&apos;s
              meter and the car, part of the energy is lost on the way — cable,
              conversion, heat. The building pays for it, so it is split in
              proportion to what each unit consumed:{" "}
              {(context.lossBasisPoints / 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
              % of the energy on each invoice.
            </li>
          </ol>
          <p>
            The prices per time band apply from{" "}
            {formatDate(context.tariffValidFrom)} and are frozen inside each
            invoice: a new tariff only applies to the following months, never
            to a bill already issued.
          </p>
          {context.tariffSourceReference ? (
            <p>Reference document: {context.tariffSourceReference}</p>
          ) : null}
        </div>
      </section>

      {invoice.items.length > 0 ? (
        <section className="invoice-block" aria-labelledby="invoice-advice-title">
          <div className="dashboard-section-heading">
            <h2 id="invoice-advice-title">What to do with this</h2>
            <span>What it would cost charging at another time</span>
          </div>
          {cheaper.length === 0 ? (
            <p className="invoice-empty">
              These sessions were already billed in the tariff&apos;s cheapest time
              band. There is no saving to be had just by changing when you
              charge.
            </p>
          ) : (
            <>
              <div className="responsible-table-frame">
                <table aria-label="Comparison between time bands">
                  <thead>
                    <tr>
                      <th>If everything were charged</th>
                      <th>Hours</th>
                      <th>Price</th>
                      <th>The energy would cost</th>
                      <th>Saving</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cheaper.map((band) => (
                      <tr key={band.code}>
                        <td>{band.label}</td>
                        <td>{band.hours}</td>
                        <td>{formatRate(band.rateCentsPerKwh)}</td>
                        <td>{formatCents(band.energyValueCents)}</td>
                        <td>
                          {formatCents(
                            invoice.energyValueCents - band.energyValueCents,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3}>This invoice, as billed</td>
                      <td>{formatCents(invoice.energyValueCents)}</td>
                      <td>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="invoice-note">
                The calculation takes the same energy as this invoice,
                recomputed as if every session had started in that time band,
                with this invoice&apos;s tariff and the same rounding per session.
                It is not a promise of savings: it depends on when the car is
                charged next month.
              </p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
