---
name: Marinner
description: CRM e gestão de escola náutica no WhatsApp — ponte de comando densa, dark-first, laranja da marca.
colors:
  primary: "oklch(0.646 0.222 41)"
  primary-hover: "oklch(0.71 0.2 41)"
  primary-soft: "oklch(0.646 0.222 41 / 0.12)"
  primary-foreground: "oklch(0.985 0 0)"
  background-dark: "oklch(0.13 0.01 260)"
  foreground-dark: "oklch(0.985 0 0)"
  card-dark: "oklch(0.18 0.01 260)"
  card-2-dark: "oklch(0.205 0.01 260)"
  muted-dark: "oklch(0.22 0.01 260)"
  muted-foreground-dark: "oklch(0.65 0.01 260)"
  border-dark: "oklch(0.28 0.01 260)"
  sidebar-dark: "oklch(0.16 0.01 260)"
  background-light: "oklch(0.99 0.002 260)"
  foreground-light: "oklch(0.21 0.01 260)"
  card-light: "oklch(1 0 0)"
  muted-foreground-light: "oklch(0.52 0.015 260)"
  border-light: "oklch(0.922 0.004 260)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.375rem 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "{colors.background-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
    height: "2rem"
  button-ghost:
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
    height: "2rem"
  card:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  input:
    backgroundColor: "{colors.muted-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
---

# Design System: Marinner

## Overview

**Creative North Star: "A Ponte de Comando"**

A interface do Marinner é um posto de operação: escura por padrão, densa o bastante para inbox e funil no mesmo turno de trabalho, com o laranja do logotipo como farol de ação — não como decoração de marketing. A marca da **escola** (logo + nome no shell) lidera a identidade no tenant; o chrome do produto permanece neutro e subordinado.

Densidade e scanability vencem expressão. Tokens em OKLCH, superfícies frias (matiz ~260), tipografia única (Inter) e cantos moderados (`0.625rem` base). Modo claro existe como opção; a identidade visual do produto é o dark + accent laranja.

**Key Characteristics:**
- Dark-first; light é opt-in
- Accent padrão = laranja da logo (`#ea580c` / `oklch(0.646 0.222 41)`); 12 accents por dispositivo
- Profundidade por tom e ring, não por sombra ostensiva
- Controles compactos (botão default `h-8`)
- White-label da escola no shell; Marinner no apex

## Colors

Paleta operacional: neutros frios quase monocromáticos + um accent quente de marca.

### Primary
- **Farol Marinner** (`oklch(0.646 0.222 41)`, hex de marca `#ea580c`): CTAs, links, ring de foco, item ativo da sidebar, chart-1. Hover via `--primary-hover`; tints `--primary-soft` / `--primary-soft-2` para pills e fundos leves.

### Secondary
Omitido como papel de marca — “secondary” no código é superfície neutra (`--secondary`), não um segundo accent.

### Neutral
- **Ponte (bg dark)** (`oklch(0.13 0.01 260)`): canvas do app
- **Convés (card)** (`oklch(0.18 0.01 260)`): painéis e cards; `card-2` um degrau acima para hover/tiles
- **Sidebar** (`oklch(0.16 0.01 260)`): navegação permanente
- **Névoa (muted-fg)** (`oklch(0.65 0.01 260)`): legendas e meta
- **Costura (border)** (`oklch(0.28 0.01 260)`): divisórias e rings sutis
- **Light canvas** (`oklch(0.99 0.002 260)`): modo claro; cards brancos, bordas `oklch(0.922 …)`

### Named Rules
**The One Beacon Rule.** O accent aparece em ações e estado ativo — não como fundo de página inteira nem gradiente decorativo.

**The School Crest Rule.** No tenant, logo/nome da escola no shell; no apex, logo Marinner. Não misturar as duas identidades no mesmo cabeçalho.

## Typography

**Display Font:** Inter (via `next/font`, variável `--font-sans`)  
**Body Font:** Inter (mesmo stack)  
**Label/Mono Font:** Geist Mono mapeado como `--font-mono` quando necessário

**Character:** Tipografia utilitária de ferramenta — uma família, hierarquia por peso/tamanho, sem display ornamental. Inter é o incumbe atual; troca tipográfica exige decisão explícita de redesign, não “melhoria” oportunista.

### Hierarchy
Três níveis no módulo Configurações (`src/components/settings/settings-type.ts`):
- **L1 painel** (600, `text-lg` / tracking-tight): título da aba (`SettingsPanelHead`)
- **L2 seção** (500, `text-base` / leading-snug): `CardTitle` e títulos de bloco
- **L3 corpo / meta** (`text-sm` corrido; `text-xs` escaneável): dicas, listas secundárias, badges

Fora de Configurações, o mesmo contraste se aplica: título de card/seção em `text-base` medium; corpo em `text-sm`; meta em `text-xs`. Labels de formulário ficam em `text-sm` medium.

### Named Rules
**The One Voice Type Rule.** Não introduzir uma segunda família “para dar personalidade” em telas Operate sem atualizar este DESIGN.md.

## Layout

App shell: sidebar + área principal. Densidade alta em inbox/listas; settings com `max-w-3xl` e ritmo `space-y-8` / `gap-3`–`4`. Mobile: hierarquia empilhada, alvos tocáveis, ações secundárias discretas (já documentado em regras de UI responsiva do projeto).

Espaçamento prático: `0.5rem` / `1rem` / `1.5rem` como ritmo; radius base `0.625rem` com escala `sm`→`4xl` derivada.

### Named Rules
**The Tool Density Rule.** Em superfícies Operate (inbox, funil, configs), preferir compactação legível a hero marketing ou cards vazios.

## Elevation & Depth

**Flat-by-default.** Profundidade vem de degraus tonais (`background` → `card` → `card-2` / `muted`) e de `ring-1 ring-foreground/10` nos cards — não de sombras grandes em repouso.

### Shadow Vocabulary
- Sombras ostensivas **não** são o idioma padrão do sistema.
- Foco: `ring` / `focus-visible:ring-ring` (cor do accent).
- Scrollbar: thumb discreto misturado com `--border`.

### Named Rules
**The Flat-By-Default Rule.** Superfícies em repouso são planas. Elevação visual = tom ou ring; sombra só se o componente já a exigir por estado (ex. popover do design system).

## Shapes

Cantos **moderadamente arredondados**: base `--radius: 0.625rem` (10px). Botões `rounded-lg`; cards `rounded-xl`. Swatches de tema e avatares podem ser `rounded-full`. Sem cantos zero (broadsheet) e sem pílulas em tudo.

### Named Rules
**The Soft Instrument Rule.** Formas lembram instrumento digital moderno, não cartaz editorial nem skeuomorphism náutico literal (cordas, madeira, âncoras decorativas).

## Components

### Buttons
- **Shape:** `rounded-lg` (~8–10px)
- **Primary:** `bg-primary` / `text-primary-foreground`, altura default `h-8`, padding compacto — **compacto e confiante**
- **Hover / Focus:** primary ~80% opacity no hover de âncoras; focus-visible com ring do accent
- **Outline / Ghost / Destructive / Link:** variantes shadcn `base-nova` em `@/components/ui/button`

### Chips
- Pills de status/role: borda + fundo soft (ex. `border-*/40 bg-*/10`); não usar accent puro como fundo de chip denso

### Cards / Containers
- **Corner:** `rounded-xl`
- **Background:** `bg-card`; hover tiles `bg-card-2` / `bg-muted`
- **Border:** `ring-1 ring-foreground/10` (não box-shadow forte)
- **Padding:** `py-4` / `px-4` (sm: `py-3` / `px-3`)

### Inputs / Fields
- Fundo `bg-muted` ou `bg-input`, borda `--border`, radius alinhado ao botão
- Focus: borda/ring `primary`
- Erro: tokens `destructive` + ring inválido do design system

### Navigation
- Sidebar escura, item ativo com tint `primary-soft` / indicador primary
- Marca no topo: logo da escola ou Marinner default (`DEFAULT_LOGO_SRC`)

### Accent swatches (Settings)
- Círculos de cor com ring quando ativos; check em `primary-foreground` do tema vigente

## Do's and Don'ts

### Do:
- **Do** usar tokens semânticos (`bg-background`, `text-muted-foreground`, `bg-primary`) — nunca hex solto em feature UI.
- **Do** manter dark como default do produto; light como preferência do dispositivo.
- **Do** reservar o laranja (ou accent escolhido) para ação e estado.
- **Do** respeitar white-label: shell mostra a escola no tenant.
- **Do** manter densidade de ferramenta em inbox/funil/settings.

### Don't:
- **Don't** aplicar gradientes roxo→azul / purple SaaS genérico como identidade Marinner.
- **Don't** aninhar cards dentro de cards sem necessidade operacional.
- **Don't** usar cinza puro sem tint (neutros já carregam matiz 260).
- **Don't** transformar o app Operate em landing (hero full-bleed, stats strips no primeiro viewport do CRM).
- **Don't** inventar tipografia display “náutica” sem redesign acordado — o incumbe é Inter.
- **Don't** pintar fundos inteiros com primary; soft tints no máximo.
