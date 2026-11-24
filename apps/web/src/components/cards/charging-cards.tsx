"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  listAssignmentUnits,
  listChargingCards,
  registerChargingCard,
  revokeChargingCard,
  type AssignmentUnitResponse,
  type ChargingCardResponse,
} from "@ev-chargeops/api-client";

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

type Loaded = {
  cards: ChargingCardResponse[];
  units: AssignmentUnitResponse[];
};

type CardsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: Loaded };

const LOADING: CardsState = { status: "loading" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

/** Where the administration says which unit a card answers for.
 *
 * The charger authenticates the card and the SEMS+ report carries its id; only
 * this registry knows who pays for it. Everything a card attributes afterwards
 * flows from a statement made once, here, by a named manager.
 */
export function ChargingCards({ accessToken }: { accessToken: string }) {
  const [generation, setGeneration] = useState(0);
  const [resolved, setResolved] = useState<{
    key: number;
    state: CardsState;
  } | null>(null);
  const state = resolved?.key === generation ? resolved.state : LOADING;

  const [cardId, setCardId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [label, setLabel] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;

    void Promise.all([
      listChargingCards(accessToken, { baseUrl: apiUrl }),
      listAssignmentUnits(accessToken, apiUrl),
    ])
      .then(([cards, units]) => {
        if (!ignore) {
          setResolved({
            key: generation,
            state: {
              status: "ready",
              data: { cards: cards.items, units: units.items },
            },
          });
        }
      })
      .catch(() => {
        if (!ignore) setResolved({ key: generation, state: { status: "error" } });
      });

    return () => {
      ignore = true;
    };
  }, [accessToken, generation]);

  const register = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      setNotice(null);
      try {
        await registerChargingCard(
          { cardId: cardId.trim(), unitId, label: label.trim() },
          accessToken,
          { baseUrl: apiUrl },
        );
        setCardId("");
        setLabel("");
        setGeneration((value) => value + 1);
      } catch (error: unknown) {
        // The refusals carry the reason the manager needs to hear, so they are
        // shown as written rather than flattened into "something went wrong".
        const body =
          error instanceof ApiError && typeof error.body === "object"
            ? (error.body as { error?: { message?: string } })
            : null;
        setNotice(
          body?.error?.message ?? "Could not register the card.",
        );
      } finally {
        setBusy(false);
      }
    },
    [accessToken, cardId, unitId, label],
  );

  const revoke = useCallback(
    async (card: ChargingCardResponse) => {
      setBusy(true);
      setNotice(null);
      try {
        await revokeChargingCard(card.id, accessToken, { baseUrl: apiUrl });
        setGeneration((value) => value + 1);
      } catch {
        setNotice("Could not revoke the card.");
      } finally {
        setBusy(false);
      }
    },
    [accessToken],
  );

  return (
    <div className="charging-cards-page">
      <header className="dashboard-heading">
        <div>
          <PageBreadcrumb section="Operations" current="Cards" />
          <h1>Charging cards</h1>
          <p>
            The charger authenticates the card but does not know whose it is.
            Here the administration says so once, and every later session with
            that card assigns itself.
          </p>
        </div>
      </header>

      {notice ? <p className="invoice-status error">{notice}</p> : null}
      {state.status === "loading" ? (
        <p className="invoice-status">Loading cards…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="invoice-status error">
          Could not load the cards.
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          <section className="invoice-block" aria-labelledby="card-form-title">
            <div className="dashboard-section-heading">
              <h2 id="card-form-title">Register a card</h2>
              <span>The number printed on the card, not the charger&apos;s serial</span>
            </div>
            <form className="card-form" onSubmit={(event) => void register(event)}>
              <label>
                <span>Card number</span>
                <input
                  value={cardId}
                  onChange={(event) => setCardId(event.target.value)}
                  placeholder="RFID-A101-0001"
                  minLength={3}
                  required
                />
              </label>
              <label>
                <span>Unit</span>
                <select
                  value={unitId}
                  onChange={(event) => setUnitId(event.target.value)}
                  required
                >
                  <option value="">Select</option>
                  {state.data.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code} · {unit.residentName ?? unit.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Description</span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Ana Souza's card"
                  minLength={2}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-dashboard-action compact"
                disabled={busy}
              >
                {busy ? "Registering…" : "Register card"}
              </button>
            </form>
          </section>

          <section className="invoice-block" aria-labelledby="card-list-title">
            <div className="dashboard-section-heading">
              <h2 id="card-list-title">Registered cards</h2>
              <span>{state.data.cards.length}</span>
            </div>
            {state.data.cards.length === 0 ? (
              <p className="invoice-empty">
                No cards registered. Until there is one, every session goes
                through the review queue.
              </p>
            ) : (
              <div className="responsible-table-frame">
                <table aria-label="Registered cards">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Unit</th>
                      <th>Description</th>
                      <th>Registered by</th>
                      <th>On</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.cards.map((card) => (
                      <tr key={card.id}>
                        <td className="card-number">{card.cardId}</td>
                        <td>{card.unitCode}</td>
                        <td>{card.label}</td>
                        <td>{card.registeredByName ?? "—"}</td>
                        <td>{formatDate(card.registeredAt)}</td>
                        <td>
                          {card.revokedAt ? (
                            <span className="pending">
                              revoked on {formatDate(card.revokedAt)}
                            </span>
                          ) : (
                            <span className="assigned">active</span>
                          )}
                        </td>
                        <td className="invoice-row-actions">
                          {card.revokedAt ? null : (
                            <button
                              type="button"
                              onClick={() => void revoke(card)}
                              disabled={busy}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="invoice-note">
              Revoking does not erase the past: the sessions the card already
              assigned stay assigned, and the history still says it was that
              card.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
