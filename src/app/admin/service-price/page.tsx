"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

type ServicePrices = {
  plus_cents: number;
  pro_cents: number;
  currency: string;
  updated_at: string;
  updated_by: string | null;
};

/**
 * /admin/service-price — central pricing control.
 *
 * Edit plan prices in one place. Changes propagate to:
 *   - /pricing (public pricing page)
 *   - /app/features (in-app upgrade page)
 *   - /api/billing/prices (API endpoint)
 *   - Checkout CTAs across the app
 *
 * The admin sets prices in cents. The display shows dollar amounts for clarity.
 */
export default function ServicePricePage() {
  const qc = useQueryClient();

  const pricesQ = useQuery<ServicePrices>({
    queryKey: ["admin", "service-prices"],
    queryFn: async () => {
      const r = await fetch("/api/admin/service-prices");
      if (!r.ok) throw new Error(`http_${r.status}`);
      const j = await r.json();
      return j.prices as ServicePrices;
    },
  });

  const [plusCents, setPlusCents] = useState(500);
  const [proCents, setProCents] = useState(900);
  const [currency, setCurrency] = useState("usd");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (pricesQ.data) {
      setPlusCents(pricesQ.data.plus_cents);
      setProCents(pricesQ.data.pro_cents);
      setCurrency(pricesQ.data.currency);
      setDirty(false);
    }
  }, [pricesQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/service-prices", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plus_cents: plusCents, pro_cents: proCents, currency }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `http_${r.status}`);
      }
    },
    onSuccess: () => {
      toast.success("Prices updated");
      qc.invalidateQueries({ queryKey: ["admin", "service-prices"] });
      qc.invalidateQueries({ queryKey: ["pricing"] });
      setDirty(false);
    },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });

  const formatDollars = (cents: number) => {
    const major = cents / 100;
    return Number.isInteger(major) ? `$${major}` : `$${major.toFixed(2)}`;
  };

  return (
    <div className="px-8 md:px-12 py-12 max-w-3xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · Service Price
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Pricing<em className="font-display">, your call.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          Set plan prices here. Changes apply everywhere: the public pricing page,
          in-app upgrade buttons, and checkout flows.
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {pricesQ.isLoading ? (
        <p className="text-sm text-muted-fg italic font-display">
          Loading current prices...
        </p>
      ) : pricesQ.error ? (
        <div className="surface border border-border rounded-lg p-6">
          <p className="text-sm text-danger">
            Couldn't load prices: {String(pricesQ.error)}
          </p>
          <p className="text-xs text-muted-fg mt-2">
            Make sure the <code>service_prices</code> table exists. Run migration <code>0027_service_prices.sql</code> in Supabase.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plus */}
            <div className="surface border border-border rounded-xl p-6">
              <h2 className="font-display text-2xl tracking-tight mb-1">Plus</h2>
              <p className="text-xs text-muted-fg mb-5">
                Calendar sync, unlimited editions, reflection.
              </p>
              <label className="block text-xs text-muted-fg mb-1">
                Monthly price (cents)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={plusCents}
                  onChange={(e) => {
                    setPlusCents(parseInt(e.target.value) || 0);
                    setDirty(true);
                  }}
                  className="input h-10 w-32 text-right font-mono"
                />
                <span className="text-lg font-semibold text-fg">
                  {formatDollars(plusCents)}
                  <span className="text-sm text-muted-fg font-normal"> / month</span>
                </span>
              </div>
            </div>

            {/* Pro */}
            <div className="surface border-2 border-accent rounded-xl p-6">
              <h2 className="font-display text-2xl tracking-tight mb-1">Pro</h2>
              <p className="text-xs text-muted-fg mb-5">
                Full AI co-pilot, semantic search, priority support.
              </p>
              <label className="block text-xs text-muted-fg mb-1">
                Monthly price (cents)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={proCents}
                  onChange={(e) => {
                    setProCents(parseInt(e.target.value) || 0);
                    setDirty(true);
                  }}
                  className="input h-10 w-32 text-right font-mono"
                />
                <span className="text-lg font-semibold text-fg">
                  {formatDollars(proCents)}
                  <span className="text-sm text-muted-fg font-normal"> / month</span>
                </span>
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="surface border border-border rounded-xl p-6">
            <label className="block text-xs text-muted-fg mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setDirty(true);
              }}
              className="input h-10 w-40"
            >
              <option value="usd">USD ($)</option>
              <option value="eur">EUR (€)</option>
              <option value="gbp">GBP (£)</option>
              <option value="twd">TWD (NT$)</option>
              <option value="jpy">JPY (¥)</option>
            </select>
          </div>

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending}
              className="btn-primary h-10 px-6 disabled:opacity-50"
            >
              {save.isPending ? "Saving..." : "Save prices"}
            </button>
            {dirty && (
              <span className="text-xs text-muted-fg italic">Unsaved changes</span>
            )}
          </div>

          {/* Last updated */}
          {pricesQ.data?.updated_at && (
            <p className="text-xs text-muted-fg mt-4">
              Last updated: {new Date(pricesQ.data.updated_at).toLocaleString()}
            </p>
          )}

          {/* Info */}
          <div className="border-t border-border pt-6 mt-6">
            <h3 className="font-display text-base mb-2">How it works</h3>
            <ul className="text-sm text-muted-fg space-y-1.5 list-disc pl-4">
              <li>Prices here override the <code>LEMONSQUEEZY_*_PRICE_CENTS</code> env vars.</li>
              <li>Changes propagate to the public <strong>/pricing</strong> page and all in-app CTAs.</li>
              <li>These are <em>display</em> prices. Actual billing amounts are set in your Lemon Squeezy product configuration.</li>
              <li>Keep display prices in sync with Lemon Squeezy to avoid confusion.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
