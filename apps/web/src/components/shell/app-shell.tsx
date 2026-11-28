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

/** One stroke icon per destination, drawn on a 20px grid.
 *
 * They are decoration: the link text stays the accessible name.
 */
const icons = {
  overview: "M3.5 3.5h5.5v7H3.5zM11 3.5h5.5v4H11zM11 9.5h5.5v7H11zM3.5 12.5h5.5v4H3.5z",
  sessions: "M11 2.5 4.5 11.5h5l-.5 6 6.5-9h-5z",
  cards: "M2.5 5.5h15v9h-15zM2.5 8.5h15M5.5 11.75h3",
  closing: "M4.5 2.5h8l3 3v12h-11zM12.5 2.5v3h3M7.25 11.25l2 2 3.5-4",
  invoices: "M5 2.5h10v15l-2.5-1.5L10 17.5 7.5 16 5 17.5zM7.75 7h4.5M7.75 10h4.5",
  sources: "M10 2.5c3.6 0 6.5 1 6.5 2.5S13.6 7.5 10 7.5 3.5 6.5 3.5 5 6.4 2.5 10 2.5zM3.5 5v5c0 1.5 2.9 2.5 6.5 2.5s6.5-1 6.5-2.5V5M3.5 10v5c0 1.5 2.9 2.5 6.5 2.5s6.5-1 6.5-2.5v-5",
  shield: "M10 2.5 16 5v4.5c0 3.7-2.4 6.6-6 8-3.6-1.4-6-4.3-6-8V5zM7.5 10l1.75 1.75L12.5 8.5",
} as const;

function NavIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icons[name]} />
    </svg>
  );
}

const operationalDestinations = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/sessions", label: "Sessions", icon: "sessions" },
  { href: "/charging-cards", label: "Cards", icon: "cards" },
] as const;

/** Closing is a monthly decision, not daily monitoring.
 *
 * It approves, emits documents and records who signed, so it lives apart from
 * the screens the manager checks in passing.
 */
const settingsDestinations = [
  { href: "/settings/data-sources", label: "Data sources", icon: "sources" },
] as const;

const billingDestinations = [
  { href: "/closing", label: "Closing", icon: "closing" },
  { href: "/invoices", label: "Invoices", icon: "invoices" },
] as const;

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
          <span className="product-signal" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M11.2 1.8 4 11.4h4.9l-.7 6.8L15.6 8.6h-4.9z" />
            </svg>
          </span>
          <p className="product-name">EV ChargeOps</p>
        </div>

        <nav aria-label="Operations" className="primary-navigation">
          <p className="navigation-label">Operations</p>
          {operationalDestinations.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`nav-link${pathname === href ? " active" : ""}`}
            >
              <NavIcon name={icon} />
              {label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Billing" className="primary-navigation">
          <p className="navigation-label">Billing</p>
          {billingDestinations.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent(href) ? "page" : undefined}
              className={`nav-link${isCurrent(href) ? " active" : ""}`}
            >
              <NavIcon name={icon} />
              {label}
            </Link>
          ))}
        </nav>

        <nav aria-label="Settings" className="secondary-navigation">
          <p className="navigation-label">Settings</p>
          {settingsDestinations.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`nav-link secondary${pathname === href ? " active" : ""}`}
            >
              <NavIcon name={icon} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="rail-status">
          <span className="status-pulse" aria-hidden="true">
            <NavIcon name="shield" />
          </span>
          <div>
            <span className="utility-label">Environment</span>
            <p>Protected operation</p>
          </div>
        </div>

        {/* Where the product comes from, said once and quietly: it sits under
            the navigation so it never competes with the product's own name. */}
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
