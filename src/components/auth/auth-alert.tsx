import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthAlert({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        className,
      )}
    >
      {children}
    </div>
  );
}
