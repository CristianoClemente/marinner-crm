"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SemAcessoClient({ apexUrl }: { apexUrl: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        403
      </p>
      <h1 className="text-2xl font-semibold text-foreground">
        Você não tem acesso a esta escola
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Sua conta está vinculada a outra organização. Abra o portal da sua
        escola ou saia para entrar com outro usuário.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href={apexUrl} className={cn(buttonVariants())}>
          Ir para o portal
        </Link>
        <Button type="button" variant="outline" onClick={handleLogout}>
          Sair
        </Button>
      </div>
    </main>
  );
}
