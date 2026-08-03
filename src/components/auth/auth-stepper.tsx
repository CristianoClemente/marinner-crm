import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthStepperProps = {
  steps: string[];
  current: number;
};

/** Progresso informativo do cadastro multi-step. */
export function AuthStepper({ steps, current }: AuthStepperProps) {
  return (
    <ol className="flex w-full items-start gap-1.5" aria-label="Progresso">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={`${index}-${label}`}
            className="flex min-w-0 flex-1 flex-col items-stretch gap-1.5"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary/15 text-primary ring-1 ring-primary/40",
                  !done &&
                    !active &&
                    "bg-muted text-muted-foreground ring-1 ring-foreground/10",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    "h-px min-w-0 flex-1",
                    done ? "bg-primary/50" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            <span
              className={cn(
                "truncate text-left text-[11px] leading-tight",
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="sr-only">
                {active ? "Etapa atual: " : done ? "Concluída: " : "Pendente: "}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
