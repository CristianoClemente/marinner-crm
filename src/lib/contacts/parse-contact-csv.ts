/**
 * CSV parsing for the contacts import modal.
 * Headers mirror writable columns on `public.contacts` (+ optional `tags`).
 */

export interface ParsedContactRow {
  phone: string;
  name?: string;
  email?: string;
  /** Tag names from the optional `tags` column (comma/semicolon separated). */
  tagNames: string[];
  cpf?: string;
  data_nascimento?: string;
  status?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  complemento?: string;
  cep?: string;
  possui_cha?: boolean;
  numero_cha?: string;
  categoria_cha?: string;
  vencimento_cha?: string;
  doc_numero?: string;
  doc_orgao_emissor?: string;
  doc_data_emissao?: string;
  profissao?: string;
  genero?: string;
}

/** Colunas do CSV alinhadas ao schema de `contacts` (+ tags via relação). */
export const CONTACT_CSV_HEADERS = [
  'phone',
  'name',
  'email',
  'tags',
  'cpf',
  'data_nascimento',
  'status',
  'endereco',
  'numero',
  'bairro',
  'cidade',
  'estado',
  'complemento',
  'cep',
  'possui_cha',
  'numero_cha',
  'categoria_cha',
  'vencimento_cha',
  'doc_numero',
  'doc_orgao_emissor',
  'doc_data_emissao',
  'profissao',
  'genero',
] as const;

export type ContactCsvHeader = (typeof CONTACT_CSV_HEADERS)[number];

const TEXT_FIELDS = [
  'name',
  'email',
  'cpf',
  'data_nascimento',
  'status',
  'endereco',
  'numero',
  'bairro',
  'cidade',
  'estado',
  'complemento',
  'cep',
  'numero_cha',
  'categoria_cha',
  'vencimento_cha',
  'doc_numero',
  'doc_orgao_emissor',
  'doc_data_emissao',
  'profissao',
  'genero',
] as const satisfies readonly Exclude<
  ContactCsvHeader,
  'phone' | 'tags' | 'possui_cha'
>[];

/** Exemplo preenchido no modelo (mesmos headers da tabela). */
const TEMPLATE_EXAMPLE: Record<ContactCsvHeader, string> = {
  phone: '5511999999999',
  name: 'Maria Silva',
  email: 'maria@email.com',
  tags: '"vip,lead"',
  cpf: '12345678901',
  data_nascimento: '1990-05-15',
  status: 'lead',
  endereco: 'Rua das Flores',
  numero: '100',
  bairro: 'Centro',
  cidade: 'São Paulo',
  estado: 'SP',
  complemento: 'Apto 12',
  cep: '01310100',
  possui_cha: 'true',
  numero_cha: '123456',
  categoria_cha: 'arrais_amador',
  vencimento_cha: '2027-12-31',
  doc_numero: '123456789',
  doc_orgao_emissor: 'SSP-SP',
  doc_data_emissao: '2015-01-20',
  profissao: 'Engenheira',
  genero: 'feminino',
};

/** CSV modelo (UTF-8 com BOM) para download no modal de importação. */
export function buildContactCsvTemplate(): string {
  const header = CONTACT_CSV_HEADERS.join(',');
  const example = CONTACT_CSV_HEADERS.map((key) => TEMPLATE_EXAMPLE[key]).join(
    ','
  );
  return `\uFEFF${header}\n${example}\n`;
}

export function downloadContactCsvTemplate(
  filename = 'modelo-contatos.csv'
): void {
  const blob = new Blob([buildContactCsvTemplate()], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Payload de insert no Supabase a partir de uma linha parseada. */
export function toContactInsertFields(
  row: ParsedContactRow
): Record<string, string | boolean | null> {
  const possuiCha = row.possui_cha ?? false;
  return {
    phone: row.phone,
    name: row.name ?? null,
    email: row.email ?? null,
    cpf: row.cpf ?? null,
    data_nascimento: row.data_nascimento ?? null,
    status: row.status ?? null,
    endereco: row.endereco ?? null,
    numero: row.numero ?? null,
    bairro: row.bairro ?? null,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    complemento: row.complemento ?? null,
    cep: row.cep ?? null,
    possui_cha: possuiCha,
    numero_cha: possuiCha ? (row.numero_cha ?? null) : null,
    categoria_cha: possuiCha ? (row.categoria_cha ?? null) : null,
    vencimento_cha: possuiCha ? (row.vencimento_cha ?? null) : null,
    doc_numero: row.doc_numero ?? null,
    doc_orgao_emissor: row.doc_orgao_emissor ?? null,
    doc_data_emissao: row.doc_data_emissao ?? null,
    profissao: row.profissao ?? null,
    genero: row.genero ?? null,
  };
}

/** Split a CSV cell into unique tag names (case-insensitive de-dupe). */
export function parseTagCell(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of value.split(/[,;]/)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

function parseBooleanCell(value: string | undefined): boolean | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'sim', 'yes', 's', 'y'].includes(normalized)) return true;
  if (['false', '0', 'nao', 'não', 'no', 'n'].includes(normalized)) return false;
  return undefined;
}

function cellAt(values: string[], idx: number): string | undefined {
  if (idx < 0) return undefined;
  const raw = values[idx]?.replace(/["']/g, '').trim();
  return raw || undefined;
}

export interface ParseContactCsvResult {
  rows: ParsedContactRow[];
  /** True when the CSV header includes a `tags` column. */
  hasTagsColumn: boolean;
}

export function parseContactCsv(text: string): ParseContactCsvResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], hasTagsColumn: false };
  }

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/["']/g, '')
  );

  const phoneIdx = headers.indexOf('phone');
  if (phoneIdx === -1) {
    return { rows: [], hasTagsColumn: false };
  }

  const tagsIdx = headers.indexOf('tags');
  const possuiChaIdx = headers.indexOf('possui_cha');
  const textIdx = Object.fromEntries(
    TEXT_FIELDS.map((field) => [field, headers.indexOf(field)])
  ) as Record<(typeof TEXT_FIELDS)[number], number>;

  const rows: ParsedContactRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const phone = cellAt(values, phoneIdx);
    if (!phone) continue;

    const row: ParsedContactRow = {
      phone,
      tagNames:
        tagsIdx >= 0 ? parseTagCell(values[tagsIdx]?.replace(/["']/g, '')) : [],
    };

    for (const field of TEXT_FIELDS) {
      const value = cellAt(values, textIdx[field]);
      if (value) row[field] = value;
    }

    const possuiCha = parseBooleanCell(cellAt(values, possuiChaIdx));
    if (possuiCha !== undefined) row.possui_cha = possuiCha;

    rows.push(row);
  }

  return {
    rows,
    hasTagsColumn: tagsIdx >= 0,
  };
}

/** Simple CSV line parse (handles quoted fields). */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}
