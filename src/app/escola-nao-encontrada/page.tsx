import Link from "next/link";

import { getApexUrl } from "@/lib/domain";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EscolaNaoEncontradaPage() {
  const apex = getApexUrl();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        404
      </p>
      <h1 className="text-2xl font-semibold text-foreground">
        Escola não encontrada
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Este endereço não corresponde a nenhuma escola cadastrada. Confira o
        link ou acesse o portal Marinner.
      </p>
      <Link href={apex} className={cn(buttonVariants())}>
        Ir para o portal
      </Link>
    </main>
  );
}
