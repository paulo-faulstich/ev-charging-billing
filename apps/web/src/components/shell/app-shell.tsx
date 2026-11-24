"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { logout } from "@/app/(app)/actions";
import {
  ResidentBanner,
  useResidentContext,
} from "@/lib/billing/resident-context";

const operationalDestinations = [
  { href: "/dashboard", label: "Overview" },
  { href: "/sessions", label: "Sessions" },
  { href: "/charging-cards", label: "Cards" },
];

/** Closing is a monthly decision, not daily monitoring.
 *
 * It approves, emits documents and records who signed, so it lives apart from
 * the screens the manager checks in passing.
 */
const settingsDestinations = [
  { href: "/settings/data-sources", label: "Data sources" },
];

const billingDestinations = [
  { href: "/closing", label: "Closing" },
  { href: "/invoices", label: "Invoices" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { context: residentContext, exit: exitResidentContext } =
    useResidentContext();
  // An invoice opened from the closing keeps the reader inside that task, so
  // the rail must not claim they left it for the invoice list.
  const openedFromClosing =
    pathname.startsWith("/invoices/") && searchParams.get("from") === "closing";

  function isCurrent(href: string): boolean {
    if (openedFromClosing) return href === "/closing";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className={`app-shell${residentContext ? " resident-view" : ""}`}>
      {/* Outside the workspace on purpose: the warning is about the whole
          session, so it has to cross the rail too, and the shell reserves the
          room for it. */}
      {residentContext ? (
        <ResidentBanner context={residentContext} onExit={exitResidentContext} />
      ) : null}
      <aside className="product-rail">
        <div className="product-identity">
          <span className="product-signal" aria-hidden="true" />
          <div>
            <p className="product-name">EV ChargeOps</p>
            <div className="product-partnership">
              <span className="product-partner-name">FIAP Challenge</span>
              <span className="product-partner-cross" aria-hidden="true">
                ×
              </span>
              <Image
                src="/brands/goodwe-logo.svg"
                width={74}
                height={11}
                alt="GoodWe: Smart Energy Innovator"
                priority
              />
            </div>
          </div>
        </div>

        <nav aria-label="Operations" className="primary-navigation">
          <p className="navigation-label">Operations</p>
          {operationalDestinations.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`nav-link${pathname === href ? " active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Billing" className="primary-navigation">
          <p className="navigation-label">Billing</p>
          {billingDestinations.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent(href) ? "page" : undefined}
              className={`nav-link${isCurrent(href) ? " active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Settings" className="secondary-navigation">
          <p className="navigation-label">Settings</p>
          {settingsDestinations.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`nav-link secondary${pathname === href ? " active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="rail-status">
          <span className="status-pulse" aria-hidden="true" />
          <div>
            <span className="utility-label">Environment</span>
            <p>Protected operation</p>
          </div>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-workspace-header">
          <div>
            <p className="dashboard-site-name">Powered by GoodWe / SEMS+</p>
            <p className="dashboard-site-meta">
              Site: Parkview Residences · 1 charger
            </p>
          </div>
          <details className="manager-menu">
            <summary
              className="manager-context"
              role="button"
              aria-label="Open Paulo Faulstich's menu"
            >
              <div>
                <span>Administrator</span>
                <strong>Paulo Faulstich</strong>
              </div>
              <span
                className="manager-avatar"
                aria-label="Administrator Paulo Faulstich"
              >
                PF
              </span>
              <span className="manager-menu-chevron" aria-hidden="true">
                ▾
              </span>
            </summary>
            <div
              className="manager-popover"
              role="menu"
              aria-label="User profile"
            >
              <div className="manager-popover-identity">
                <span className="utility-label">Active account</span>
                <strong>Paulo Faulstich</strong>
                <span>Building administrator</span>
              </div>
              <form action={logout}>
                <button type="submit" role="menuitem">
                  <span>Sign out</span>
                  <span aria-hidden="true">→</span>
                </button>
              </form>
            </div>
          </details>
        </header>
        <main className="app-workspace-content">{children}</main>
      </div>
    </div>
  );
}
