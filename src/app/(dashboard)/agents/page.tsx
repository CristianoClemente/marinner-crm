'use client';

import { useEffect, useState } from 'react';
import { Bot, Sparkles, Settings2, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'playground' | 'setup' | 'usage';

export default function AgentsPage() {
  const { accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);

  // Land first-time users on Setup, returning users on the Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/config');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTab(data?.configured ? 'playground' : 'setup');
      } catch {
        if (!cancelled) setTab('setup');
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Agentes de IA
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Seu agente de IA com chave própria — configure-o e teste no playground
        antes que ele responda aos clientes na caixa de entrada.
      </p>

      {decided && (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="mt-6"
        >
          {/* `w-full`: a lista é `w-fit` com gatilhos `whitespace-nowrap`, e as
              três abas rotuladas somam ~300px contra os 288px úteis a 320px.
              No mobile ficam só os ícones e a lista divide a largura em três.
              `min-h-10` (não `h-10`) porque a altura da lista vem de um
              group-variant que o Tailwind emite depois das utilidades base e
              venceria um `h-*` passado aqui. */}
          <TabsList className="w-full min-h-10 sm:min-h-8">
            <TabsTrigger value="playground" aria-label="Playground">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Playground</span>
            </TabsTrigger>
            <TabsTrigger value="setup" aria-label="Configuração">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Configuração</span>
            </TabsTrigger>
            {canViewUsage && (
              <TabsTrigger value="usage" aria-label="Uso">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Uso</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground onGoToSetup={() => setTab('setup')} />
          </TabsContent>

          <TabsContent value="setup" className="mt-4">
            <AiConfig />
          </TabsContent>

          {canViewUsage && (
            <TabsContent value="usage" className="mt-4">
              <AiUsageCard />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
