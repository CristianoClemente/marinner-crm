"use client";

import { cn } from "@/lib/utils";

export type PlanOption = {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  max_seats: number;
  features: Record<string, unknown>;
};

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type PlanPickerProps = {
  plans: PlanOption[];
  value: string;
  onChange: (code: string) => void;
  recommendedCode?: string;
  seatsLabel: (count: number) => string;
  perMonthLabel: string;
  recommendedLabel: string;
  loading?: boolean;
  loadingLabel?: string;
};

export function PlanPicker({
  plans,
  value,
  onChange,
  recommendedCode = "pro",
  seatsLabel,
  perMonthLabel,
  recommendedLabel,
  loading,
  loadingLabel,
}: PlanPickerProps) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{loadingLabel}</p>
    );
  }

  return (
    <div className="grid gap-2" role="radiogroup">
      {plans.map((p) => {
        const active = value === p.code;
        const recommended = p.code === recommendedCode;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.code)}
            className={cn(
              "relative rounded-xl px-3.5 py-3 text-left transition-colors",
              "ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/10 ring-primary"
                : "bg-muted/50 ring-foreground/10 hover:bg-muted",
            )}
          >
            {recommended ? (
              <span className="absolute top-2.5 right-2.5 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {recommendedLabel}
              </span>
            ) : null}
            <div className="flex items-baseline justify-between gap-3 pr-16">
              <span className="text-sm font-medium text-foreground">
                {p.name}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-foreground">
                {formatBrl(p.price_cents)}
                <span className="text-xs text-muted-foreground">
                  /{perMonthLabel}
                </span>
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {seatsLabel(p.max_seats)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
