/** Normaliza e valida CPF/CNPJ (somente dígitos). */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpfCnpj(raw: string): boolean {
  const d = digitsOnly(raw);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

function isValidCpf(cpf: string): boolean {
  if (/^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  if (rev !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  return rev === Number(cpf[10]);
}

function isValidCnpj(cnpj: string): boolean {
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(cnpj[i]) * w1[i];
  let rev = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (rev !== Number(cnpj[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(cnpj[i]) * w2[i];
  rev = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return rev === Number(cnpj[13]);
}
