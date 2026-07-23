# Perguntas — SaaS B2B (Marinner / wacrm)

Use este documento para marcar as escolhas. Com as respostas, montamos o plano técnico faseado.

**Como usar:** marque `[x]` nas opções escolhidas (ou responda no chat no formato do final do arquivo).

---

## Contexto rápido (já mapeado no código)

O que **já existe**:
- Multi-workspace por `accounts` + RLS (`account_id`)
- Equipe com roles `owner` / `admin` / `agent` / `viewer` + convites
- Produto: inbox, contatos, funis, broadcasts, automações, fluxos, IA (BYO key), API keys
- 1 número WhatsApp por conta

O que **falta** para SaaS comercial:
- Planos, trial, billing, quotas
- Console de plataforma
- Onboarding de empresa
- Ciclo trial → ativo → inadimplente → cancelado
- Multi-conta por usuário / seletor de empresa (hoje: 1 usuário = 1 account)

Arquivos-chave: [`src/lib/auth/account.ts`](../src/lib/auth/account.ts), [`src/lib/auth/roles.ts`](../src/lib/auth/roles.ts), migração `017_account_sharing.sql`, [`README.md`](../README.md).

---

## 1. Modelo de SaaS

**O que esta pergunta decide:** quem cria a empresa no sistema, como o cliente entra e como você opera o produto no dia a dia.

Pense em: *“O cliente se cadastra sozinho no site, ou eu ativo a conta depois de uma conversa comercial?”*

### Opções

- [X] **A) Hospedado único, self-serve** (cadastro → trial → pago)

  **O que é:** um único app na nuvem (ex.: `app.marinner.com.br`) com muitas empresas no mesmo banco. O cliente entra no site, cria conta, testa sozinho e paga.

  **Resposta registrada:** self-serve — o cliente cria a empresa e vira `owner`; cada empresa tem slug (`minhaempresa.marinner.com.br`).


## 2. Cobrança no MVP (Brasil)

**O que esta pergunta decide:** como o dinheiro entra no começo — integração automática ou processo manual.

Pense em: *“No primeiro mês de clientes pagantes, o boleto/PIX precisa sair sozinho do sistema ou posso mandar a cobrança no WhatsApp?”*

### Opções

- [X] **A) Asaas** (PIX + boleto + cartão)

  **O que é:** gateway brasileiro. O app cria cobrança/assinatura; o cliente paga PIX/boleto/cartão; webhook avisa o Marinner (“pago” / “atrasado”).

  **Exemplo:** plano R$ 297/mês → Asaas gera PIX → cliente paga → status da conta vira `active` automaticamente; se vencer, vira `past_due` e o app bloqueia broadcasts.

  **Prós:** encaixa no BR (PIX/boleto).  
  **Contras:** tempo de integração + conta Asaas + webhooks.

- [ ] **B) Stripe**

  **O que é:** gateway global (cartão; PIX via Stripe Brasil em alguns cenários). Muito comum em SaaS internacionais.

  **Exemplo:** checkout Stripe no painel → cartão → assinatura mensal.

  **Prós:** docs maduras, ecossistema grande.  
  **Contras:** no BR, PIX/boleto e nota fiscal costumam ser mais naturais no Asaas (ou híbrido); onboarding de conta pode ser mais chato para CNPJ local.

- [ ] **C) Planos/limites no app + cobrança manual** (gateway depois)

  **O que é:** o sistema já sabe o plano (Starter/Pro) e aplica limites, mas você cobra fora (PIX, boleto, Nota). Depois pluga Asaas/Stripe.

  **Exemplo:** você marca a conta como plano Pro no console admin; cliente te paga R$ 297 via PIX no celular; se atrasar 7 dias, você muda o status para `past_due` e o app trava recursos.

  **Prós:** MVP em dias, não semanas; valida preço antes de integrar gateway.  
  **Contras:** operação manual; risco de esquecer de suspender inadimplente.

- [ ] **D) Ainda não sei — recomendar o caminho mais rápido**

  **O que é:** você quer a recomendação padrão para lançar rápido no Brasil.

  **Recomendação típica:** começar com **C** (manual + planos no app) e, com 5–10 clientes pagantes, migrar para **A (Asaas)**.

**Sua resposta:** `_` (ex.: C ou D)

**Notas (opcional):**


---

## 3. Perguntas extras (úteis, mas podem esperar)

### 3.1 Marca / produto

**O que decide:** o que o cliente vê na tela de login, e-mails e fatura — e se cada empresa pode parecer “o próprio CRM”.

- [X] **Marinner como marca do SaaS** DEFAULT

  **Exemplo:** login em `app.marinner.com.br`, título “Marinner”, e-mails “Equipe Marinner”. O produto deixa de se apresentar como wacrm.

- [ ] **Manter wacrm / outra marca**

  **Exemplo:** continua “wacrm” ou vira “OutroNome CRM”; Marinner fica só como empresa dona do código.

- [X] **White-label por cliente** (logo/cores por empresa)

  **Exemplo:** a Escola X entra e vê o logo dela e cores dela no header (como se fosse o CRM da escola). Mais complexo; normalmente fase 2+.

**Resposta:** `_`

### 3.2 Unidade de cobrança

**O que decide:** o que aparece na tabela de preços e o que o sistema precisa contar/limitar.

- [ ] **Por seat (usuário)**

  **Exemplo:** R$ 79 por agente/mês. Empresa com 1 owner + 3 agentes = 4 seats × R$ 79.  
  *Bom quando o valor está no time atendendo inbox.*

- [X] **Plano flat por empresa**

  **Exemplo:** Starter R$ 197 / Pro R$ 397 / Business R$ 797 — preço fixo, independente de quantos usuários (talvez com teto: “até 5 usuários”).  
  *Bom para venda simples e proposta comercial clara.*

- [ ] **Uso** (mensagens / broadcasts / IA)

  **Exemplo:** R$ 0,05 por mensagem enviada, ou pacote de 10.000 mensagens/mês; IA cobrada por tokens.  
  *Bom se o custo variável (Meta/API) for alto; mais difícil de explicar na venda.*

- [ ] **Híbrido** (plano + seats ou uso)

  **Exemplo:** Pro R$ 297/mês inclui 3 usuários e 5.000 mensagens; seat extra R$ 49; mensagem extra R$ 0,03.  
  *Mais flexível, mais trabalho de produto e billing.*

**Resposta:** `_`

### 3.3 WhatsApp

**O que decide:** se uma empresa pode ter vários números oficiais no mesmo workspace.

- [X] **Continuar 1 número por conta** (como hoje)

  **Exemplo:** “Loja Centro” tem só o `+55 11 9…` no Marinner. Filial precisa de outra conta (ou outro número só depois de evoluir o produto).  
  *Alinha com o código atual (`UNIQUE` em `whatsapp_config.account_id`).*

- [ ] **Multi-número por empresa no roadmap**

  **Exemplo:** mesma empresa com número de Vendas e número de Suporte, ambos no mesmo inbox/contatos, com filtros.  
  *Mudança de schema + UX; não é MVP.*

**Resposta:** `_`

### 3.4 Trial

**O que decide:** como o cliente experimenta antes de pagar — e se você pede cartão no cadastro.

- [ ] **Dias de trial (quantos?): `_`**

  **Exemplo:** `14` dias com todos (ou quase todos) os recursos; no dia 15 pede upgrade ou bloqueia envios.  
  *Comum em B2B BR: 7 ou 14 dias.*

- [X] **Cartão obrigatório no cadastro**

  **Exemplo:** só cria conta se cadastrar cartão; trial de 14 dias e cobra automático no fim (modelo tipo Netflix).  
  *Reduz curiosos; aumenta fricção e precisa de gateway desde o dia 1.*

- [ ] **Sem cartão no trial**

  **Exemplo:** cadastra e-mail, usa 14 dias, no fim escolhe plano e só então paga PIX.  
  *Combina bem com vendas assistidas (1B) e cobrança manual (2C).*

**Resposta:** `_` (ex.: 14 dias, sem cartão)

---

