export type AgendaEventKind = "reminder" | "event";
export type AgendaEventStatus = "active" | "canceled";

export type AgendaColorKey =
  | "orange"
  | "sky"
  | "emerald"
  | "violet"
  | "rose"
  | "amber"
  | "slate"
  | "teal";

export const AGENDA_COLOR_KEYS = [
  "orange",
  "sky",
  "emerald",
  "violet",
  "rose",
  "amber",
  "slate",
  "teal",
] as const satisfies readonly AgendaColorKey[];

/** Classes Tailwind para chip/calendário (sem hex solto). */
export const AGENDA_COLOR_CLASS: Record<
  AgendaColorKey,
  { swatch: string; chip: string }
> = {
  orange: {
    swatch: "bg-orange-500",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  sky: {
    swatch: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  emerald: {
    swatch: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  violet: {
    swatch: "bg-violet-500",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  rose: {
    swatch: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  amber: {
    swatch: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  },
  slate: {
    swatch: "bg-slate-500",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
  teal: {
    swatch: "bg-teal-500",
    chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
};

export type AgendaAssignee = {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
};

export interface AgendaEvent {
  id: string;
  account_id: string;
  kind: AgendaEventKind;
  title: string;
  starts_at: string;
  ends_at: string | null;
  color_key: AgendaColorKey;
  notes: string | null;
  status: AgendaEventStatus;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  assignees?: AgendaAssignee[];
}

export function isAgendaColorKey(value: unknown): value is AgendaColorKey {
  return (
    typeof value === "string" &&
    (AGENDA_COLOR_KEYS as readonly string[]).includes(value)
  );
}

export function isAgendaEventKind(value: unknown): value is AgendaEventKind {
  return value === "reminder" || value === "event";
}
