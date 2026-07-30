import { cn } from "@/lib/utils";

/**
 * Moldura única para estado vazio, sem resultado e erro de carregamento:
 * ícone em bloco tonal, título, descrição e uma ação opcional.
 *
 * O tom só troca a cor do bloco do ícone — `primary` para "ainda não há nada,
 * comece por aqui", `muted` para busca sem resultado, `destructive` para falha.
 */
function StateCard({
  tone = "muted",
  icon,
  title,
  description,
  action,
  className,
}: {
  tone?: "primary" | "muted" | "destructive";
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "flex size-12 items-center justify-center rounded-xl [&_svg]:size-6",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "muted" && "bg-muted text-muted-foreground",
          tone === "destructive" && "bg-destructive/10 text-destructive",
        )}
      >
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { StateCard };
