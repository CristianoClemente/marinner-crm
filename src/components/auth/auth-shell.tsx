import type { ReactNode } from "react";
import { DEFAULT_LOGO_SRC } from "@/lib/brand";
import type { AuthBrand } from "@/components/auth/auth-brand";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  brand?: AuthBrand | null;
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
  /** Wider panel for plan / billing steps */
  size?: "md" | "lg";
};

/**
 * Operate auth chrome — bridge canvas, flat card, Marinner beacon.
 */
export function AuthShell({
  brand,
  icon,
  title,
  description,
  children,
  footer,
  headerExtra,
  className,
  size = "md",
}: AuthShellProps) {
  const logoSrc = brand?.logoUrl || DEFAULT_LOGO_SRC;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-4 py-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,var(--primary-soft),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div
        className={cn(
          "relative w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
          size === "lg" ? "max-w-lg" : "max-w-md",
          className,
        )}
      >
        <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 p-1.5 ring-1 ring-primary/20">
              {icon ?? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt=""
                  className="size-full object-contain"
                />
              )}
            </div>
            {brand ? (
              <p className="mb-1 text-sm font-medium text-foreground">
                {brand.name}
              </p>
            ) : null}
            <h1 className="text-lg font-medium leading-snug tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {description}
              </div>
            ) : null}
            {headerExtra ? (
              <div className="mt-5 w-full">{headerExtra}</div>
            ) : null}
          </div>
          {children}
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
