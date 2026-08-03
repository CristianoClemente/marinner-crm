export type MaritimeAuthority = {
  id: number;
  sigla: string;
  nome: string;
  logradouro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
};

export type AccountJurisdiction = {
  id: string;
  account_id: string;
  authority_id: number;
  responsible_user_id: string;
  email_override: string | null;
  is_default: boolean;
};
