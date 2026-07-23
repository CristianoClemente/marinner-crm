import { describe, expect, it } from 'vitest';
import {
  buildContactCsvTemplate,
  CONTACT_CSV_HEADERS,
  parseContactCsv,
  parseTagCell,
  toContactInsertFields,
} from './parse-contact-csv';

describe('buildContactCsvTemplate', () => {
  it('mirrors contacts table headers and is parseable', () => {
    const csv = buildContactCsvTemplate();
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain(CONTACT_CSV_HEADERS.join(','));

    const parsed = parseContactCsv(csv.replace(/^\uFEFF/, ''));
    expect(parsed.hasTagsColumn).toBe(true);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      phone: '5511999999999',
      name: 'Maria Silva',
      email: 'maria@email.com',
      tagNames: ['vip', 'lead'],
      cpf: '12345678901',
      status: 'lead',
      cidade: 'São Paulo',
      estado: 'SP',
      possui_cha: true,
      categoria_cha: 'arrais_amador',
      genero: 'feminino',
    });
  });
});

describe('toContactInsertFields', () => {
  it('maps parsed row to contacts insert payload', () => {
    expect(
      toContactInsertFields({
        phone: '5511999999999',
        name: 'Maria',
        tagNames: ['vip'],
        cpf: '12345678901',
        possui_cha: true,
      })
    ).toMatchObject({
      phone: '5511999999999',
      name: 'Maria',
      email: null,
      cpf: '12345678901',
      possui_cha: true,
    });
  });
});

describe('parseTagCell', () => {
  it('splits comma-separated tags and trims whitespace', () => {
    expect(parseTagCell(' VIP , Lead ,  ')).toEqual(['VIP', 'Lead']);
  });

  it('splits semicolon-separated tags', () => {
    expect(parseTagCell('VIP; Lead; Customer')).toEqual([
      'VIP',
      'Lead',
      'Customer',
    ]);
  });

  it('de-dupes case-insensitively', () => {
    expect(parseTagCell('vip, VIP, Lead')).toEqual(['vip', 'Lead']);
  });

  it('returns empty for blank values', () => {
    expect(parseTagCell('')).toEqual([]);
    expect(parseTagCell(undefined)).toEqual([]);
  });
});

describe('parseContactCsv', () => {
  it('parses optional tags column', () => {
    const csv = `phone,name,tags
+15551234567,Alice,"VIP, Lead"
+15559876543,Bob,Customer`;

    expect(parseContactCsv(csv)).toEqual({
      hasTagsColumn: true,
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          tagNames: ['VIP', 'Lead'],
        },
        {
          phone: '+15559876543',
          name: 'Bob',
          tagNames: ['Customer'],
        },
      ],
    });
  });

  it('parses extended contacts columns', () => {
    const csv = `phone,name,cpf,status,cidade,estado,possui_cha,genero
5511888777666,João,98765432100,aluno,Santos,SP,sim,masculino`;

    expect(parseContactCsv(csv).rows[0]).toMatchObject({
      phone: '5511888777666',
      name: 'João',
      cpf: '98765432100',
      status: 'aluno',
      cidade: 'Santos',
      estado: 'SP',
      possui_cha: true,
      genero: 'masculino',
      tagNames: [],
    });
  });

  it('returns empty tagNames when tags column is absent', () => {
    const csv = `phone,name
+15551234567,Alice`;

    expect(parseContactCsv(csv)).toEqual({
      hasTagsColumn: false,
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          tagNames: [],
        },
      ],
    });
  });

  it('ignores a company column if present in the CSV', () => {
    const csv = `phone,name,company
+15551234567,Alice,Acme`;

    expect(parseContactCsv(csv)).toEqual({
      hasTagsColumn: false,
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          tagNames: [],
        },
      ],
    });
  });
});
