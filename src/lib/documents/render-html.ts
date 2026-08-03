import type { DocumentPayload } from "@/lib/documents/types";
import { renderAtestadoArraisHtml } from "@/lib/documents/templates/atestado-arrais";
import { renderAtestadoMotonautaHtml } from "@/lib/documents/templates/atestado-motonauta";
import { renderDeclaracaoResidenciaHtml } from "@/lib/documents/templates/declaracao-residencia";
import { renderRequerimentoHtml } from "@/lib/documents/templates/requerimento";

export function renderDocumentHtml(payload: DocumentPayload): string {
  switch (payload.kind) {
    case "atestado_arrais":
      return renderAtestadoArraisHtml(payload);
    case "atestado_motonauta":
      return renderAtestadoMotonautaHtml(payload);
    case "declaracao_residencia":
      return renderDeclaracaoResidenciaHtml(payload);
    case "requerimento_capitania":
      return renderRequerimentoHtml(payload);
    default: {
      const _exhaustive: never = payload;
      return _exhaustive;
    }
  }
}
