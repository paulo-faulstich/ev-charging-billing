"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { listInvoices, type InvoiceResponse } from "@ev-chargeops/api-client";

import { useResidentContext } from "@/lib/billing/resident-context";
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

function formatCents(cents: number): string {
  const reais = Math.trunc(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  return `${cents < 0 ? "-" : ""}R$ ${reais.toLocaleString("pt-BR")},${String(rest).padStart(2, "0")}`;
}

function formatKwh(value: string): string {
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kWh`;
}

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; invoices: InvoiceResponse[] };

const LOADING: ListState = { status: "loading" };

export function InvoiceList({ accessToken }: { accessToken: string }) {
  const router = useRouter();
  const { context, enter } = useResidentContext();
  const residentContextId = context?.id ?? null;
  const requestKey = residentContextId ?? "manager";
  const [resolved, setResolved] = useState<{
    key: string;
    state: ListState;
  } | null>(null);
  const state = resolved?.key === requestKey ? resolved.state : LOADING;

  useEffect(() => {
    let ignore = false;

    void listInvoices(
      accessToken,
      {},
      { baseUrl: apiUrl, residentContextId },
    )
      .then((response) => {
        if (!ignore) {
          setResolved({
            key: requestKey,
            state: { status: "ready", invoices: response.items },
          });
        }
      })
      .catch(() => {
        if (!ignore) {
          setResolved({ key: requestKey, state: { status: "error" } });
        }
      });

    return () => {
      ignore = true;
    };
  }, [accessToken, residentContextId, requestKey]);

  const impersonate = useCallback(
    async (invoice: InvoiceResponse) => {
      await enter(invoice.unitId);
      router.push(`/invoices/${invoice.id}`);
    },
    [enter, router],
  );

  const invoices = state.status === "ready" ? state.invoices : [];
  const periods = [...new Set(invoices.map((invoice) => invoice.periodValue))]
    .sort()
    .reverse();
  const totalCents = invoices.reduce(
    (total, invoice) => total + invoice.totalCents,
    0,
  );
  const totalEnergy = invoices.reduce(
    (total, invoice) => total + Number(invoice.energyKwh),
    0,
  );

  return (
    <div className="invoice-list-page">
      <header className="dashboard-heading">
        <div>
          <PageBreadcrumb section="Billing" current="Invoices" />
          <h1>Invoices</h1>
          <p>
            Each invoice is immutable once issued and explains itself, row by
            row.
          </p>
        </div>
      </header>

      {state.status === "loading" ? (
        <p className="invoice-status">Loading invoices…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="invoice-status error">
          Could not load the invoices.
        </p>
      ) : null}
      {state.status === "ready" && state.invoices.length === 0 ? (
        <section className="invoice-block">
          <p className="invoice-empty">
            No invoices issued yet. They appear here once a period is approved
            at closing.
          </p>
        </section>
      ) : null}

      {state.status === "ready" && state.invoices.length > 0 ? (
        <section className="invoice-block" aria-labelledby="invoice-list-title">
          <div className="dashboard-section-heading">
            <h2 id="invoice-list-title">Invoices issued</h2>
            <span>
              {periods.length}{" "}
              {periods.length === 1 ? "period" : "periods"}
            </span>
          </div>
          {/* The closing screen shows what one approval produced. This one is
              the archive, so it states what has been billed in total. */}
          <dl className="invoice-period-summary">
            <div>
              <dt>Invoices issued</dt>
              <dd>{state.invoices.length}</dd>
            </div>
            <div>
              <dt>Energy billed</dt>
              <dd>{formatKwh(String(totalEnergy))}</dd>
            </div>
            <div>
              <dt>Total billed</dt>
              <dd>{formatCents(totalCents)}</dd>
            </div>
            <div>
              <dt>Periods</dt>
              <dd>{periods.join(" · ")}</dd>
            </div>
          </dl>
          <div className="responsible-table-frame">
            <table aria-label="Invoices issued">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Unit</th>
                  <th>Responsible</th>
                  <th>Energy</th>
                  <th>Total</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {state.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.periodValue}</td>
                    <td>{invoice.unitCode}</td>
                    <td>{invoice.contactLabel}</td>
                    <td>{formatKwh(invoice.energyKwh)}</td>
                    <td>{formatCents(invoice.totalCents)}</td>
                    <td className="invoice-row-actions">
                      <Link href={`/invoices/${invoice.id}`}>Open</Link>
                      {context === null ? (
                        <button
                          type="button"
                          onClick={() => void impersonate(invoice)}
                        >
                          View as resident
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
