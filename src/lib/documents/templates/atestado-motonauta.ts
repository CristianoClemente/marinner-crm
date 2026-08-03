import type { AtestadoPayload } from "@/lib/documents/types";
import { escapeHtml, printDocumentShell } from "@/lib/documents/templates/shell";

/** NORMAM-212 An. 3-B */
export function renderAtestadoMotonautaHtml(payload: AtestadoPayload): string {
  const c = payload.contact;
  const i = payload.instructor;
  const loc = payload.location;
  const body = `
  <h1>ANEXO 3-B</h1>
  <h2>ATESTADO DE TREINAMENTO NÁUTICO PARA MOTONAUTA</h2>
  <p class="meta">NORMAM-212/DPC — modelo operacional da escola (não substitui a norma oficial)</p>

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

  <h3>Plano de treinamento teórico (mín. 60 min) — ambiente náutico</h3>
  <table>
    <thead><tr><th>Tipo de treinamento</th><th>Duração</th><th>Instrutor</th><th>CHA</th></tr></thead>
    <tbody>
      <tr>
        <td>Apresentação da MA / regras de governo / saída e aproximação / emergências / passageiros / equipamentos de segurança</td>
        <td>${escapeHtml(String(payload.theoreticalMinutes ?? 60))} min</td>
        <td>${escapeHtml(i.full_name)}</td>
        <td>${escapeHtml(i.cha_number)}</td>
      </tr>
    </tbody>
  </table>

  <h3>Plano de treinamento prático (mín. 60 min) — a bordo em navegação</h3>
  <table>
    <thead><tr><th>Tipo de treinamento</th><th>Duração</th><th>Instrutor</th><th>CHA</th></tr></thead>
    <tbody>
      <tr>
        <td>Manobras e pilotagem / limites operacionais / regras de governo / saída-aproximação / emergências / equipamentos</td>
        <td>${escapeHtml(String(payload.practicalMinutes ?? 60))} min</td>
        <td>${escapeHtml(i.full_name)}</td>
        <td>${escapeHtml(i.cha_number)}</td>
      </tr>
    </tbody>
  </table>

  <p class="attest">
    Atesto, para os devidos fins, que o(a) Sr.(a.)
    <strong>${escapeHtml(c.name ?? "")}</strong>,
    CPF nº <strong>${escapeHtml(c.cpf ?? "")}</strong>,
    cumpriu o treinamento prático em moto aquática junto a
    <strong>${escapeHtml(payload.school.name)}</strong>,
    tendo o(a) Sr.(a.) <strong>${escapeHtml(i.full_name)}</strong> como instrutor(a)
    (CHA: ${escapeHtml(i.cha_number)}).
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
