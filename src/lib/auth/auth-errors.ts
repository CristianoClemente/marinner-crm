// Traduz mensagens de erro do Supabase Auth (que chegam em inglês) para
// PT-BR, já que são exibidas diretamente ao usuário no login/cadastro/
// recuperação de senha. Casos não mapeados caem num fallback genérico.

const AUTH_ERROR_MAP: { pattern: RegExp; message: string }[] = [
  { pattern: /invalid login credentials/i, message: "E-mail ou senha incorretos." },
  { pattern: /email not confirmed/i, message: "Confirme seu e-mail antes de entrar." },
  { pattern: /user already registered/i, message: "Este e-mail já está cadastrado." },
  { pattern: /already been registered/i, message: "Este e-mail já está cadastrado." },
  { pattern: /password should be at least (\d+)/i, message: "A senha deve ter pelo menos 6 caracteres." },
  { pattern: /unable to validate email address/i, message: "Endereço de e-mail inválido." },
  { pattern: /invalid email/i, message: "Endereço de e-mail inválido." },
  { pattern: /email rate limit exceeded/i, message: "Muitas tentativas. Tente novamente em alguns minutos." },
  { pattern: /for security purposes.*(\d+) seconds/i, message: "Por segurança, aguarde alguns segundos antes de tentar novamente." },
  { pattern: /signups not allowed|signup is disabled/i, message: "O cadastro está desativado no momento." },
  { pattern: /token has expired|invalid.*token/i, message: "O link expirou ou é inválido. Solicite um novo." },
  { pattern: /new password should be different/i, message: "A nova senha deve ser diferente da atual." },
  { pattern: /network|fetch failed|failed to fetch/i, message: "Não foi possível conectar ao servidor. Verifique sua conexão." },
];

export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Ocorreu um erro. Tente novamente.";
  const match = AUTH_ERROR_MAP.find((entry) => entry.pattern.test(message));
  return match ? match.message : "Não foi possível concluir a solicitação. Tente novamente.";
}
