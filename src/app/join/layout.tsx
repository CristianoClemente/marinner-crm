import type { ReactNode } from "react";

/**
 * Layout híbrido: anônimo e autenticado (fora de (auth)/(dashboard)).
 * Metadata (favicon/tenant) fica na page do token.
 */
export default function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}
