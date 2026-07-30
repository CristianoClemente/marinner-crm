import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import {
  isEquipmentKind,
  isEquipmentStatus,
  validateEquipmentCreate,
} from "@/lib/equipment/validate";

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status");
    const kind = url.searchParams.get("kind");

    let query = supabase
      .from("equipment")
      .select("*")
      .eq("account_id", accountId)
      .order("name", { ascending: true });

    if (status && isEquipmentStatus(status)) query = query.eq("status", status);
    if (kind && isEquipmentKind(kind)) query = query.eq("kind", kind);
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,plate_or_registration.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/equipment]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (data ?? []).map((e) => e.id);
    const nextDueByEquipment = new Map<string, string>();
    if (ids.length > 0) {
      const { data: maint } = await supabase
        .from("equipment_maintenances")
        .select("equipment_id, next_due_on")
        .eq("account_id", accountId)
        .in("equipment_id", ids)
        .not("next_due_on", "is", null)
        .neq("status", "cancelled")
        .order("next_due_on", { ascending: true });

      for (const row of maint ?? []) {
        if (!row.next_due_on) continue;
        if (!nextDueByEquipment.has(row.equipment_id)) {
          nextDueByEquipment.set(row.equipment_id, row.next_due_on);
        }
      }
    }

    const equipment = (data ?? []).map((e) => ({
      ...e,
      next_maintenance_due_on: nextDueByEquipment.get(e.id) ?? null,
    }));

    return NextResponse.json({ equipment });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateEquipmentCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("equipment")
      .insert({ account_id: ctx.accountId, ...parsed.value })
      .select("*")
      .single();

    if (error) {
      console.error("[POST /api/equipment]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ equipment: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
