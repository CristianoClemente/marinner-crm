/**
 * Modelos de início rápido para funis (process templates).
 *
 * Catálogo estático — mesmo padrão de Automações/Fluxos. O clique na
 * galeria só pré-preenche o dialog; Salvar usa as APIs existentes.
 *
 * Spec: docs/superpowers/specs/2026-08-03-process-template-quick-starts-design.md
 */

import type { AdvanceMode, ProcessFieldType } from "@/lib/processes/types";

export type QuickStartSlug =
  | "sales_pipeline"
  | "arrais_amador"
  | "motonauta";

/** Taxonomia de produto: venda × processo (despachante etc. = process). */
export type QuickStartKind = "sale" | "process";

export type QuickStartIcon = "Handshake" | "Ship" | "Waves";

export type QuickStartFieldSeed = {
  label: string;
  field_type: ProcessFieldType;
  required: boolean;
  /** Opções do select, se `field_type === "select"`. */
  options?: string[];
};

export type QuickStartStageSeed = {
  name: string;
  allow_skip: boolean;
  accepts_classes: boolean;
  fields: QuickStartFieldSeed[];
};

export type QuickStartCapabilities = {
  advance_mode: AdvanceMode;
  has_monetary_value: boolean;
  has_commercial_outcome: boolean;
  requires_catalog_item: boolean;
  block_advance_if_incomplete: boolean;
};

export type QuickStartTemplate = {
  slug: QuickStartSlug;
  kind: QuickStartKind;
  icon: QuickStartIcon;
  /** Nome inicial do funil (pt-BR no seed; card usa i18n). */
  defaultName: string;
  /** Deriva docs NORMAM no create do funil. */
  habilitationKind?: "arrais" | "motonauta";
  capabilities: QuickStartCapabilities;
  stages: QuickStartStageSeed[];
};

function fileField(label: string): QuickStartFieldSeed {
  return { label, field_type: "file", required: true };
}

const SALES_PIPELINE: QuickStartTemplate = {
  slug: "sales_pipeline",
  kind: "sale",
  icon: "Handshake",
  defaultName: "Funil de venda",
  capabilities: {
    advance_mode: "free",
    has_monetary_value: true,
    has_commercial_outcome: true,
    requires_catalog_item: false,
    block_advance_if_incomplete: false,
  },
  stages: [
    {
      name: "Qualificação",
      allow_skip: false,
      accepts_classes: false,
      fields: [
        {
          label: "Contexto / notas",
          field_type: "textarea",
          required: false,
        },
      ],
    },
    {
      name: "Proposta",
      allow_skip: false,
      accepts_classes: false,
      fields: [
        {
          label: "Valor esperado",
          field_type: "text",
          required: false,
        },
      ],
    },
    {
      name: "Negociação",
      allow_skip: false,
      accepts_classes: false,
      fields: [],
    },
    {
      name: "Fechamento",
      allow_skip: false,
      accepts_classes: false,
      fields: [],
    },
  ],
};

const PROCESS_DOC_FIELDS: QuickStartFieldSeed[] = [
  fileField("RG / CPF"),
  fileField("Comprovante de residência"),
  fileField("Atestado médico"),
  fileField("GRU (comprovante)"),
];

function processHabilitacao(params: {
  slug: Extract<QuickStartSlug, "arrais_amador" | "motonauta">;
  icon: QuickStartIcon;
  defaultName: string;
  trainingLabel: string;
  chaLabel: string;
}): QuickStartTemplate {
  return {
    slug: params.slug,
    kind: "process",
    icon: params.icon,
    defaultName: params.defaultName,
    habilitationKind: params.slug === "motonauta" ? "motonauta" : "arrais",
    capabilities: {
      advance_mode: "sequential",
      has_monetary_value: false,
      has_commercial_outcome: false,
      requires_catalog_item: true,
      block_advance_if_incomplete: true,
    },
    stages: [
      {
        name: "Documentação",
        allow_skip: false,
        accepts_classes: false,
        fields: PROCESS_DOC_FIELDS,
      },
      {
        name: "Pagamento",
        allow_skip: false,
        accepts_classes: false,
        fields: [fileField("Comprovante de pagamento")],
      },
      {
        name: "Aula prática",
        allow_skip: false,
        accepts_classes: true,
        fields: [fileField(params.trainingLabel)],
      },
      {
        name: "Prova",
        allow_skip: false,
        accepts_classes: false,
        fields: [
          {
            label: "Data do exame",
            field_type: "date",
            required: true,
          },
          {
            label: "Resultado",
            field_type: "select",
            required: true,
            options: ["Aprovado", "Reprovado"],
          },
        ],
      },
      {
        name: "CHA emitida",
        allow_skip: false,
        accepts_classes: false,
        fields: [
          {
            label: "Data de emissão",
            field_type: "date",
            required: false,
          },
          {
            label: params.chaLabel,
            field_type: "text",
            required: false,
          },
        ],
      },
    ],
  };
}

const ARRAIS_AMADOR = processHabilitacao({
  slug: "arrais_amador",
  icon: "Ship",
  defaultName: "Arrais-Amador",
  trainingLabel: "Atestado de treinamento (Arrais)",
  chaLabel: "Número / observações da CHA",
});

const MOTONAUTA = processHabilitacao({
  slug: "motonauta",
  icon: "Waves",
  defaultName: "Motonauta",
  trainingLabel: "Atestado de treinamento (Motonauta)",
  chaLabel: "Número / observações da CHA-MTA",
});

export const QUICK_START_TEMPLATES: Record<
  QuickStartSlug,
  QuickStartTemplate
> = {
  sales_pipeline: SALES_PIPELINE,
  arrais_amador: ARRAIS_AMADOR,
  motonauta: MOTONAUTA,
};

export const QUICK_START_ORDER: QuickStartSlug[] = [
  "sales_pipeline",
  "arrais_amador",
  "motonauta",
];

export function getQuickStartTemplate(slug: QuickStartSlug): QuickStartTemplate {
  const tpl = QUICK_START_TEMPLATES[slug];
  if (!tpl) {
    throw new Error(`Preset de início rápido desconhecido: ${slug}`);
  }
  return tpl;
}

export function isQuickStartSlug(value: string): value is QuickStartSlug {
  return Object.prototype.hasOwnProperty.call(QUICK_START_TEMPLATES, value);
}
