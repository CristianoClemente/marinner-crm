import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  assertAssigneesInAccount,
  attachAssigneesToEvents,
  replaceEventAssignees,
} from "@/lib/agenda/assignees";
import { validateAgendaEventCreate } from "@/lib/agenda/validate";

export async function GET(request: Request) {
  try {
    const ctx = await requireRole("viewer");
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status");

    let query = ctx.supabase
      .from("agenda_events")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("starts_at", { ascending: true });

    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) query = query.gte("starts_at", d.toISOString());
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) query = query.lte("starts_at", d.toISOString());
    }
    if (status === "active" || status === "canceled") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/agenda/events]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const events = await attachAssigneesToEvents(
      ctx.supabase,
      ctx.accountId,
      (data ?? []) as Array<Record<string, unknown>>,
    );
    return NextResponse.json({ events });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateAgendaEventCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const membersOk = await assertAssigneesInAccount(
      ctx.supabase,
      ctx.accountId,
      parsed.value.assignee_user_ids,
    );
    if (!membersOk.ok) {
      return NextResponse.json({ error: membersOk.message }, { status: 400 });
    }

    const { assignee_user_ids, ...eventFields } = parsed.value;
    const { data, error } = await ctx.supabase
      .from("agenda_events")
      .insert({
        account_id: ctx.accountId,
        ...eventFields,
        status: "active",
        created_by_user_id: ctx.userId,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[POST /api/agenda/events]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const replaced = await replaceEventAssignees({
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      eventId: data.id as string,
      userIds: assignee_user_ids,
    });
    if (!replaced.ok) {
      console.error("[POST /api/agenda/events] assignees", replaced.message);
      return NextResponse.json({ error: replaced.message }, { status: 500 });
    }

    const [event] = await attachAssigneesToEvents(ctx.supabase, ctx.accountId, [
      data as Record<string, unknown>,
    ]);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
