import type { RequerimentoPayload } from "@/lib/documents/types";
import { formatContactAddress } from "@/lib/documents/validate";
import { escapeHtml, printDocumentShell } from "@/lib/documents/templates/shell";

/** NORMAM-211 An. 5-H ou 212 An. 3-A conforme variant. */
export function renderRequerimentoHtml(payload: RequerimentoPayload): string {
  const c = payload.contact;
  const anexo =
    payload.variant === "motonauta" ? "ANEXO 3-A (NORMAM-212/DPC)" : "ANEXO 5-H (NORMAM-211/DPC)";
  const body = `
  <h1>${anexo}</h1>
  <h2>REQUERIMENTO</h2>
  <p class="meta">Ao: Sr. Capitão dos Portos, Delegado ou Agente — modelo operacional da escola (não substitui o formulário oficial).</p>

  <div class="row"><label>Nome</label><div class="line" style="flex:1">${escapeHtml(c.name ?? "")}</div></div>
  <div class="row"><label>CPF</label><div class="line" style="flex:1">${escapeHtml(c.cpf ?? "")}</div></div>
  <div class="row"><label>Identidade</label><div class="line" style="flex:1">${escapeHtml(c.doc_numero ?? "")}</div>
    <label>Órgão</label><div class="line" style="flex:1">${escapeHtml(c.doc_orgao_emissor ?? "")}</div></div>
  <div class="row"><label>Residência</label><div class="line" style="flex:1">${escapeHtml(formatContactAddress(c))}</div></div>
  <div class="row"><label>TEL / Celular</label><div class="line" style="flex:1">${escapeHtml(c.phone ?? "")}</div></div>
  <div class="row"><label>E-mail</label><div class="line" style="flex:1">${escapeHtml(c.email ?? "")}</div></div>

  <h3>Venho requerer a V. Sa. a realização do seguinte serviço</h3>
  <p class="check">☑ <strong>${escapeHtml(payload.serviceOption)}</strong></p>
  ${
    payload.serviceDescription
      ? `<p><strong>Descrição do pedido:</strong> ${escapeHtml(payload.serviceDescription)}</p>`
      : ""
  }

  <p class="meta">Observação: deverá ser apensada a documentação pertinente exigida na NORMAM correspondente.</p>

  <p style="margin-top:28px">${escapeHtml(payload.cityForSignature)}, ${escapeHtml(payload.issuedAt)}.</p>

  <div class="sign" style="margin-top:40px">
    <div>
      <p>_________________________________</p>
      <p>CPF ${escapeHtml(c.cpf ?? "")}</p>
      <p>Assinatura do requerente</p>
    </div>
  </div>
  `;
  return printDocumentShell(body);
}
