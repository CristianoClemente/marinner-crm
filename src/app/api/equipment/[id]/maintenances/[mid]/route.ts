import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  nextEquipmentStatusAfterMaintenance,
  shouldBumpMeter,
} from "@/lib/equipment/status-sync";
import { validateMaintenancePatch } from "@/lib/equipment/validate";
import type { EquipmentStatus, MaintenanceStatus } from "@/types";

type RouteCtx = { params: Promise<{ id: string; mid: string }> };

export async function PATCH(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id, mid } = await params;
    const body = await request.json().catch(() => null);
    const parsed = validateMaintenancePatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: maintenance, error } = await ctx.supabase
      .from("equipment_maintenances")
      .update(parsed.value)
      .eq("account_id", ctx.accountId)
      .eq("equipment_id", id)
      .eq("id", mid)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/equipment/id/maintenances/mid]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!maintenance) {
      return NextResponse.json(
        { error: "Manutenção não encontrada" },
        { status: 404 },
      );
    }

    const { data: equipment } = await ctx.supabase
      .from("equipment")
      .select("id, status, meter_value")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (equipment && parsed.value.status) {
      const nextStatus = nextEquipmentStatusAfterMaintenance(
        equipment.status as EquipmentStatus,
        parsed.value.status as MaintenanceStatus,
      );
      const bump = shouldBumpMeter(
        Number(equipment.meter_value),
        parsed.value.meter_value_at ?? maintenance.meter_value_at,
      );
      const equipPatch: Record<string, unknown> = {};
      if (nextStatus !== equipment.status) equipPatch.status = nextStatus;
      if (bump !== null) equipPatch.meter_value = bump;
      if (Object.keys(equipPatch).length > 0) {
        await ctx.supabase
          .from("equipment")
          .update(equipPatch)
          .eq("id", id)
          .eq("account_id", ctx.accountId);
      }
    }

    return NextResponse.json({ maintenance });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id, mid } = await params;

    const { data, error } = await ctx.supabase
      .from("equipment_maintenances")
      .update({ status: "cancelled" })
      .eq("account_id", ctx.accountId)
      .eq("equipment_id", id)
      .eq("id", mid)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[DELETE /api/equipment/id/maintenances/mid]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Manutenção não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ maintenance: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
