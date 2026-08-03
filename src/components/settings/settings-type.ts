/**
 * Tipografia do módulo Configurações — exatamente 3 níveis.
 *
 * L1 painel  — SettingsPanelHead (título da aba)
 * L2 seção   — CardTitle, títulos de bloco (Modo, Capacidades…)
 * L3 corpo   — texto corrido / dicas (text-sm) e meta escaneável (text-xs)
 *
 * Inter + pesos 400/500/600 já carregados. Não inventar text-[Npx].
 */
export const settingsType = {
  panelTitle: "text-lg font-semibold tracking-tight text-foreground",
  panelDescription: "mt-1 max-w-[62ch] text-sm text-muted-foreground",
  sectionTitle: "text-base font-medium leading-snug text-foreground",
  body: "text-sm text-muted-foreground",
  meta: "text-xs text-muted-foreground",
} as const;
