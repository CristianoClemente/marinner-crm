import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import {
  nextEquipmentStatusAfterMaintenance,
  shouldBumpMeter,
} from "@/lib/equipment/status-sync";
import {
  isMaintenanceStatus,
  validateMaintenanceCreate,
} from "@/lib/equipment/validate";
import type { EquipmentStatus } from "@/types";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const { data: equipment, error: eqErr } = await supabase
      .from("equipment")
      .select("id")
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();

    if (eqErr) {
      console.error("[GET /api/equipment/id/maintenances] eq", eqErr);
      return NextResponse.json({ error: eqErr.message }, { status: 500 });
    }
    if (!equipment) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 },
      );
    }

    let query = supabase
      .from("equipment_maintenances")
      .select("*")
      .eq("account_id", accountId)
      .eq("equipment_id", id)
      .order("performed_on", { ascending: false });

    if (status && isMaintenanceStatus(status)) query = query.eq("status", status);
    if (from) query = query.gte("performed_on", from);
    if (to) query = query.lte("performed_on", to);

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/equipment/id/maintenances]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ maintenances: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = validateMaintenanceCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: equipment, error: eqErr } = await ctx.supabase
      .from("equipment")
      .select("id, status, meter_value")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (eqErr) {
      console.error("[POST /api/equipment/id/maintenances] eq", eqErr);
      return NextResponse.json({ error: eqErr.message }, { status: 500 });
    }
    if (!equipment) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 },
      );
    }

    const { data: maintenance, error } = await ctx.supabase
      .from("equipment_maintenances")
      .insert({
        account_id: ctx.accountId,
        equipment_id: id,
        ...parsed.value,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[POST /api/equipment/id/maintenances]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nextStatus = nextEquipmentStatusAfterMaintenance(
      equipment.status as EquipmentStatus,
      parsed.value.status,
    );
    const bump = shouldBumpMeter(
      Number(equipment.meter_value),
      parsed.value.meter_value_at,
    );
    const equipPatch: Record<string, unknown> = {};
    if (nextStatus !== equipment.status) equipPatch.status = nextStatus;
    if (bump !== null) equipPatch.meter_value = bump;

    let updatedEquipment = equipment;
    if (Object.keys(equipPatch).length > 0) {
      const { data: refreshed, error: upErr } = await ctx.supabase
        .from("equipment")
        .update(equipPatch)
        .eq("id", id)
        .eq("account_id", ctx.accountId)
        .select("*")
        .single();
      if (upErr) {
        console.error("[POST /api/equipment/id/maintenances] sync", upErr);
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      updatedEquipment = refreshed;
    }

    return NextResponse.json(
      { maintenance, equipment: updatedEquipment },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
