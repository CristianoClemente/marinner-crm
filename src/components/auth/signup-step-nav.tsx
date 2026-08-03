import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SignupStepItem = {
  title: string;
};

type SignupStepNavProps = {
  steps: SignupStepItem[];
  current: number;
  maxReached: number;
  stepLabel: string;
  onSelect: (index: number) => void;
  footer?: ReactNode;
};

/**
 * Sidebar vertical de etapas (estilo multi-step: STEP n + título).
 * Só permite voltar até etapas já alcançadas.
 */
export function SignupStepNav({
  steps,
  current,
  maxReached,
  stepLabel,
  onSelect,
  footer,
}: SignupStepNavProps) {
  return (
    <nav
      aria-label={stepLabel}
      className="flex h-full flex-col rounded-xl bg-sidebar p-5 text-sidebar-foreground ring-1 ring-foreground/10 sm:p-6"
    >
      <ol className="flex flex-1 flex-col gap-5">
        {steps.map((item, index) => {
          const active = index === current;
          const done = index < current;
          const reachable = index <= maxReached;
          return (
            <li key={`${index}-${item.title}`}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(index)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg text-left transition-colors",
                  reachable ? "cursor-pointer" : "cursor-default opacity-60",
                  active && "opacity-100",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    active &&
                      "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    done && !active && "bg-primary/20 text-primary",
                    !done &&
                      !active &&
                      "bg-muted text-muted-foreground ring-1 ring-foreground/10",
                  )}
                  aria-hidden
                >
                  {done && !active ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {stepLabel} {index + 1}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-sm font-medium",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                  {active ? (
                    <span
                      className="mt-2 block h-0.5 w-10 rounded-full bg-primary"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {footer ? (
        <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </nav>
  );
}
