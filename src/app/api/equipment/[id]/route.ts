import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { validateEquipmentPatch } from "@/lib/equipment/validate";
import type { EquipmentKind, EquipmentStatus, EquipmentSubtype } from "@/types";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;

    const { data, error } = await supabase
      .from("equipment")
      .select(
        "*, maintenances:equipment_maintenances(*)",
      )
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/equipment/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ equipment: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const body = await request.json().catch(() => null);

    const { data: current, error: curErr } = await ctx.supabase
      .from("equipment")
      .select("kind, subtype, status")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      console.error("[PATCH /api/equipment/id] current", curErr);
      return NextResponse.json({ error: curErr.message }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 },
      );
    }

    const parsed = validateEquipmentPatch(body, {
      kind: current.kind as EquipmentKind,
      subtype: current.subtype as EquipmentSubtype,
      status: current.status as EquipmentStatus,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("equipment")
      .update(parsed.value)
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/equipment/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ equipment: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;

    const { data, error } = await ctx.supabase
      .from("equipment")
      .update({ status: "inactive" })
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[DELETE /api/equipment/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Equipamento não encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ equipment: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
