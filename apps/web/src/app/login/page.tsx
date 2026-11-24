"use client";

import Image from "next/image";
import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <main className="login-layout">
      <section className="login-intro" aria-labelledby="login-title">
        <p className="login-eyebrow">Shared EV charging operations</p>
        <div className="login-mark" aria-hidden="true" />
        <h1 id="login-title">EV ChargeOps</h1>
        <p className="login-lede">
          Charging management for shared garages: reads the charger&apos;s sessions,
          assigns each one to the responsible unit and issues the monthly
          invoice.
        </p>

        <div className="login-source">
          <p className="login-source-label">Charging data</p>
          <Image
            src="/brands/goodwe-logo.svg"
            width={196}
            height={29}
            alt="GoodWe: Smart Energy Innovator"
            priority
          />
          <p className="login-source-note">
            GoodWe HCA G2 charger at Parkview Residences, read through SEMS+.
          </p>
        </div>
      </section>

      <aside className="login-panel" aria-label="Platform access">
        <div className="login-panel-inner">
          <h2 className="login-panel-title">Sign in</h2>
          <p className="login-panel-note">
            Access restricted to the building&apos;s administration.
          </p>

          <form action={action} className="login-form">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />

            {state.error ? (
              <p role="alert" className="form-error">
                {state.error}
              </p>
            ) : null}

            <button type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </aside>
    </main>
  );
}
