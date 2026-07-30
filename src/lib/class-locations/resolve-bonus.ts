/**
 * Resolve a regra de bônus vigente para um local (Fatia 1: só genéricas).
 */

import type { LocationCostType } from "./validate";

export interface BonusRuleCandidate {
  id: string;
  bonus_type: LocationCostType;
  bonus_amount: number;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  created_at: string;
}

export function resolveBonusRule(
  rules: BonusRuleCandidate[],
  on: string,
): BonusRuleCandidate | null {
  const eligible = rules.filter((r) => {
    if (!r.active) return false;
    if (r.starts_on > on) return false;
    if (r.ends_on !== null && r.ends_on < on) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    if (a.starts_on !== b.starts_on) {
      return a.starts_on < b.starts_on ? 1 : -1;
    }
    return a.created_at < b.created_at ? 1 : -1;
  });

  return eligible[0] ?? null;
}
