import type { Contact } from '@/types';

/** Estado de formulário dos campos extras de contato (migration 037). */
export interface ContactExtendedFieldsState {
  cpf: string;
  data_nascimento: string;
  status: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento: string;
  cep: string;
  possui_cha: boolean;
  numero_cha: string;
  categoria_cha: string;
  vencimento_cha: string;
  doc_numero: string;
  doc_orgao_emissor: string;
  doc_data_emissao: string;
  profissao: string;
  genero: string;
}

export const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const CONTACT_STATUS_OPTIONS = [
  'lead',
  'interessado',
  'aluno',
  'ativo',
  'inativo',
] as const;

export const CONTACT_GENERO_OPTIONS = [
  'masculino',
  'feminino',
  'outro',
  'nao_informar',
] as const;

export const CONTACT_CATEGORIA_CHA_OPTIONS = [
  'arrais_amador',
  'motonauta',
  'veleiro',
  'capitao_amador',
  'mestre_amador',
] as const;

function asDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function emptyExtendedFields(): ContactExtendedFieldsState {
  return {
    cpf: '',
    data_nascimento: '',
    status: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    complemento: '',
    cep: '',
    possui_cha: false,
    numero_cha: '',
    categoria_cha: '',
    vencimento_cha: '',
    doc_numero: '',
    doc_orgao_emissor: '',
    doc_data_emissao: '',
    profissao: '',
    genero: '',
  };
}

export function extendedFieldsFromContact(
  contact: Contact | null | undefined,
): ContactExtendedFieldsState {
  if (!contact) return emptyExtendedFields();
  return {
    cpf: contact.cpf ?? '',
    data_nascimento: asDateInput(contact.data_nascimento),
    status: contact.status ?? '',
    endereco: contact.endereco ?? '',
    numero: contact.numero ?? '',
    bairro: contact.bairro ?? '',
    cidade: contact.cidade ?? '',
    estado: contact.estado ?? '',
    complemento: contact.complemento ?? '',
    cep: contact.cep ?? '',
    possui_cha: contact.possui_cha ?? false,
    numero_cha: contact.numero_cha ?? '',
    categoria_cha: contact.categoria_cha ?? '',
    vencimento_cha: asDateInput(contact.vencimento_cha),
    doc_numero: contact.doc_numero ?? '',
    doc_orgao_emissor: contact.doc_orgao_emissor ?? '',
    doc_data_emissao: asDateInput(contact.doc_data_emissao),
    profissao: contact.profissao ?? '',
    genero: contact.genero ?? '',
  };
}

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Payload pronto para insert/update no Supabase. */
export function serializeExtendedFields(
  state: ContactExtendedFieldsState,
): Record<string, string | boolean | null> {
  return {
    cpf: trimOrNull(state.cpf),
    data_nascimento: trimOrNull(state.data_nascimento),
    status: trimOrNull(state.status),
    endereco: trimOrNull(state.endereco),
    numero: trimOrNull(state.numero),
    bairro: trimOrNull(state.bairro),
    cidade: trimOrNull(state.cidade),
    estado: trimOrNull(state.estado),
    complemento: trimOrNull(state.complemento),
    cep: trimOrNull(state.cep),
    possui_cha: state.possui_cha,
    numero_cha: state.possui_cha ? trimOrNull(state.numero_cha) : null,
    categoria_cha: state.possui_cha ? trimOrNull(state.categoria_cha) : null,
    vencimento_cha: state.possui_cha
      ? trimOrNull(state.vencimento_cha)
      : null,
    doc_numero: trimOrNull(state.doc_numero),
    doc_orgao_emissor: trimOrNull(state.doc_orgao_emissor),
    doc_data_emissao: trimOrNull(state.doc_data_emissao),
    profissao: trimOrNull(state.profissao),
    genero: trimOrNull(state.genero),
  };
}
