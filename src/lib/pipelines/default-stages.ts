/**
 * Etapas padrão do funil.
 *
 * O banco (`pipeline_stages.name`) guarda texto livre — nunca um enum.
 * Por isso usamos:
 * - `key` estável só no front (i18n / seed)
 * - `aliases` com nomes legados (EN) e canônicos (pt-BR, ko…) já persistidos
 *
 * Assim o seed cria rótulos localizados, a UI traduz nomes conhecidos
 * sem migrar o backend, e nomes customizados passam intactos.
 */

export type DefaultStageKey =
  | 'newLead'
  | 'qualified'
  | 'proposalSent'
  | 'negotiation'
  | 'won';

export interface DefaultStageDefinition {
  key: DefaultStageKey;
  color: string;
  position: number;
  /** Todos os nomes já usados no produto para esta etapa (case-insensitive). */
  aliases: readonly string[];
}

export const DEFAULT_STAGE_DEFINITIONS: readonly DefaultStageDefinition[] = [
  {
    key: 'newLead',
    color: '#3b82f6',
    position: 0,
    aliases: ['New Lead', 'Novo lead', 'Novo Lead', '신규 리드'],
  },
  {
    key: 'qualified',
    color: '#eab308',
    position: 1,
    aliases: ['Qualified', 'Qualificado', '자격 확인'],
  },
  {
    key: 'proposalSent',
    color: '#f97316',
    position: 2,
    aliases: [
      'Proposal Sent',
      'Proposta enviada',
      'Proposta Enviada',
      '제안 발송',
    ],
  },
  {
    key: 'negotiation',
    color: '#8b5cf6',
    position: 3,
    aliases: ['Negotiation', 'Negociação', 'Negociacao', '협상'],
  },
  {
    key: 'won',
    color: '#22c55e',
    position: 4,
    aliases: ['Won', 'Ganho', '성사'],
  },
] as const;

/** Aliases do funil criado automaticamente quando a conta ainda não tem nenhum. */
export const DEFAULT_PIPELINE_NAME_ALIASES = [
  'Sales Pipeline',
  'Funil de vendas',
  '영업 파이프라인',
] as const;

export type DefaultPipelineNameTranslator = (
  key: 'defaultPipelineName',
) => string;

export type DefaultStageTranslator = (key: DefaultStageKey) => string;

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

const aliasToStageKey = new Map<string, DefaultStageKey>();
for (const def of DEFAULT_STAGE_DEFINITIONS) {
  for (const alias of def.aliases) {
    aliasToStageKey.set(normalizeLabel(alias), def.key);
  }
}

const pipelineNameAliasSet = new Set(
  DEFAULT_PIPELINE_NAME_ALIASES.map(normalizeLabel),
);

/** Resolve chave estável a partir do nome persistido no banco (ou null se custom). */
export function resolveDefaultStageKey(
  storedName: string,
): DefaultStageKey | null {
  return aliasToStageKey.get(normalizeLabel(storedName)) ?? null;
}

/** Rótulo localizado para etapas padrão; nomes customizados retornam como estão. */
export function localizeStageName(
  storedName: string,
  t: DefaultStageTranslator,
): string {
  const key = resolveDefaultStageKey(storedName);
  return key ? t(key) : storedName;
}

export function isDefaultPipelineName(storedName: string): boolean {
  return pipelineNameAliasSet.has(normalizeLabel(storedName));
}

export function localizePipelineName(
  storedName: string,
  t: DefaultPipelineNameTranslator,
): string {
  return isDefaultPipelineName(storedName)
    ? t('defaultPipelineName')
    : storedName;
}

/** Payload de insert em `pipeline_stages` (sem pipeline_id). */
export function buildDefaultStagesPayload(t: DefaultStageTranslator): Array<{
  name: string;
  color: string;
  position: number;
}> {
  return DEFAULT_STAGE_DEFINITIONS.map((def) => ({
    name: t(def.key),
    color: def.color,
    position: def.position,
  }));
}
