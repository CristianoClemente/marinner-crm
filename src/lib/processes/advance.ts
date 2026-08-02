import type { ProcessTemplateStage } from "@/lib/processes/types";

export function sortStages(
  stages: ProcessTemplateStage[],
): ProcessTemplateStage[] {
  return [...stages].sort((a, b) => a.position - b.position);
}

/**
 * Resolve o próximo estágio ao avançar.
 * - Sem force/target: próxima posição.
 * - allow_skip na etapa atual (ou force): pode ir a qualquer etapa com position maior.
 * - Se não há próxima: complete=true.
 */
export function resolveAdvance(input: {
  stages: ProcessTemplateStage[];
  currentStageId: string | null;
  targetStageId?: string | null;
  force?: boolean;
}):
  | { ok: true; complete: true }
  | { ok: true; complete: false; next: ProcessTemplateStage }
  | { ok: false; message: string } {
  const stages = sortStages(input.stages);
  if (stages.length === 0) {
    return { ok: false, message: "Template sem etapas." };
  }

  const currentIdx = input.currentStageId
    ? stages.findIndex((s) => s.id === input.currentStageId)
    : -1;
  if (input.currentStageId && currentIdx < 0) {
    return { ok: false, message: "Etapa atual inválida." };
  }

  const current = currentIdx >= 0 ? stages[currentIdx] : null;
  const canSkip = Boolean(input.force || current?.allow_skip);

  if (input.targetStageId) {
    const target = stages.find((s) => s.id === input.targetStageId);
    if (!target) {
      return { ok: false, message: "Etapa de destino inválida." };
    }
    if (current && target.position <= current.position) {
      return {
        ok: false,
        message: "Só é possível avançar para uma etapa posterior.",
      };
    }
    if (!canSkip && current && target.position > current.position + 1) {
      return {
        ok: false,
        message: "Esta etapa não permite pular. Avance em sequência.",
      };
    }
    return { ok: true, complete: false, next: target };
  }

  const nextIdx = currentIdx + 1;
  if (nextIdx >= stages.length) {
    return { ok: true, complete: true };
  }
  return { ok: true, complete: false, next: stages[nextIdx] };
}

export function isProcessStatus(
  value: string,
): value is "active" | "completed" | "canceled" {
  return value === "active" || value === "completed" || value === "canceled";
}
