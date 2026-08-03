import type { AtestadoPayload } from "@/lib/documents/types";
import { escapeHtml, printDocumentShell } from "@/lib/documents/templates/shell";

/** NORMAM-211 An. 5-E — estrutura operacional fiel aos campos do anexo. */
export function renderAtestadoArraisHtml(payload: AtestadoPayload): string {
  const c = payload.contact;
  const i = payload.instructor;
  const loc = payload.location;
  const body = `
  <h1>ANEXO 5-E</h1>
  <h2>ATESTADO DE TREINAMENTO PARA ARRAIS-AMADOR</h2>
  <p class="meta">NORMAM-211/DPC — modelo operacional da escola (não substitui a norma oficial)</p>

  <h3>Campo de preenchimento do estabelecimento de treinamento náutico</h3>
  <p><strong>Estabelecimento:</strong> ${escapeHtml(payload.school.name)}</p>
  <p><strong>Responsável perante a Autoridade Marítima:</strong> ${escapeHtml(payload.school.responsibleName ?? "—")}</p>
  ${
    payload.school.authoritySigla
      ? `<p><strong>Jurisdição:</strong> ${escapeHtml(payload.school.authoritySigla)}${payload.school.authorityNome ? ` — ${escapeHtml(payload.school.authorityNome)}` : ""}</p>`
      : ""
  }
  <p><strong>Local da aula:</strong> ${escapeHtml(loc.name)}${loc.endereco ? ` — ${escapeHtml(loc.endereco)}` : ""}</p>
  <p><strong>Data da aula / sessão:</strong> ${escapeHtml(payload.classStartsAt)}</p>

  <h3>Plano de treinamento teórico (mín. 2h) — ambiente náutico</h3>
  <table>
    <thead><tr><th>Tipo de treinamento</th><th>Duração</th><th>Instrutor</th><th>CHA</th></tr></thead>
    <tbody>
      <tr><td>Apresentação da embarcação / regras de governo / luzes e marcas / providências saída-chegada</td>
        <td>${escapeHtml(String(payload.theoreticalMinutes ?? 120))} min</td>
        <td>${escapeHtml(i.full_name)}</td><td>${escapeHtml(i.cha_number)}</td></tr>
      <tr><td>VHF / primeiros socorros / combate a incêndio / abastecimento / sobrevivência e segurança</td>
        <td>—</td><td>${escapeHtml(i.full_name)}</td><td>${escapeHtml(i.cha_number)}</td></tr>
    </tbody>
  </table>

  <h3>Plano de treinamento prático (mín. 4h) — a bordo em navegação</h3>
  <table>
    <thead><tr><th>Tipo de treinamento</th><th>Duração</th><th>Instrutor</th><th>CHA</th></tr></thead>
    <tbody>
      <tr><td>Preparar embarcação / abastecimento / luzes e sinais / regras de governo / leme-hélice / atracação-fundeio / lista de verificação</td>
        <td>${escapeHtml(String(payload.practicalMinutes ?? 240))} min</td>
        <td>${escapeHtml(i.full_name)}</td><td>${escapeHtml(i.cha_number)}</td></tr>
    </tbody>
  </table>

  <p class="attest">
    Atesto, para os devidos fins, que o(a) Sr.(a.)
    <strong>${escapeHtml(c.name ?? "")}</strong>,
    CPF nº <strong>${escapeHtml(c.cpf ?? "")}</strong>,
    cumpriu <strong>${escapeHtml(payload.trainingHoursLabel)}</strong> de treinamento teórico e prático
    em embarcação de esporte e/ou recreio junto a
    <strong>${escapeHtml(payload.school.name)}</strong>,
    tendo o(a) Sr.(a.) <strong>${escapeHtml(i.full_name)}</strong> como instrutor(a)
    (CHA/categoria: ${escapeHtml(i.cha_number)} / ${escapeHtml(i.cha_category)}).
  </p>

  <div class="sign">
    <div>
      <p>_________________________________</p>
      <p>Responsável / pessoa física cadastrada</p>
      <p>${escapeHtml(payload.school.responsibleName ?? payload.school.name)}</p>
      <p class="meta">${escapeHtml(payload.school.name)}</p>
    </div>
    <div>
      <p>_________________________________</p>
      <p>Instrutor(a)</p>
      <p>${escapeHtml(i.full_name)}</p>
    </div>
    <div>
      <p>_________________________________</p>
      <p>Aluno(a)</p>
      <p>${escapeHtml(c.name ?? "")}</p>
    </div>
  </div>
  <p class="meta">OBS.: Informações inverídicas podem acarretar cancelamento da inscrição e sanções previstas em lei.</p>
  `;
  return printDocumentShell(body);
}
