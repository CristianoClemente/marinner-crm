import type { ResidenciaPayload } from "@/lib/documents/types";
import { formatContactAddress } from "@/lib/documents/validate";
import { escapeHtml, printDocumentShell } from "@/lib/documents/templates/shell";

/** NORMAM-211 An. 2-G / 212 An. 1-C — declaração de residência. */
export function renderDeclaracaoResidenciaHtml(
  payload: ResidenciaPayload,
): string {
  const c = payload.contact;
  const address = formatContactAddress(c);
  const body = `
  <h1>DECLARAÇÃO DE RESIDÊNCIA</h1>
  <p class="meta">Modelo operacional alinhado à Lei nº 7.115/1983 e anexos NORMAM-211 (2-G) / NORMAM-212 (1-C). Não substitui o texto oficial da Autoridade Marítima.</p>

  <p class="attest">
    Eu, <strong>${escapeHtml(c.name ?? "")}</strong>,
    portador(a) do CPF nº <strong>${escapeHtml(c.cpf ?? "")}</strong>
    ${c.phone ? `, telefone ${escapeHtml(c.phone)}` : ""},
    declaro, sob as penas da lei, que residirei / resido no endereço abaixo:
  </p>

  <p><strong>Endereço:</strong></p>
  <p class="line">${escapeHtml(address)}</p>

  <p class="attest">
    Declaro ainda estar ciente de que a falsidade desta declaração configura crime
    previsto no Código Penal Brasileiro (art. 299 — falsidade ideológica).
  </p>

  <p style="margin-top:32px">${escapeHtml(payload.cityForSignature)}, ${escapeHtml(payload.issuedAt)}.</p>

  <div class="sign" style="margin-top:48px">
    <div>
      <p>_________________________________</p>
      <p>Assinatura do(a) declarante</p>
      <p>${escapeHtml(c.name ?? "")}</p>
      <p>CPF ${escapeHtml(c.cpf ?? "")}</p>
    </div>
  </div>
  `;
  return printDocumentShell(body);
}
