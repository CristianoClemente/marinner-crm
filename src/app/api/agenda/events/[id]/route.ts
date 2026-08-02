import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  assertAssigneesInAccount,
  attachAssigneesToEvents,
  replaceEventAssignees,
} from "@/lib/agenda/assignees";
import { validateAgendaEventPatch } from "@/lib/agenda/validate";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("agenda_events")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[GET /api/agenda/events/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }
    const [event] = await attachAssigneesToEvents(
      ctx.supabase,
      ctx.accountId,
      [data as Record<string, unknown>],
    );
    return NextResponse.json({ event });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateAgendaEventPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: existing, error: exErr } = await ctx.supabase
      .from("agenda_events")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (exErr) {
      console.error("[PATCH /api/agenda/events/id] load", exErr);
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }

    if (parsed.value.assignee_user_ids) {
      const membersOk = await assertAssigneesInAccount(
        ctx.supabase,
        ctx.accountId,
        parsed.value.assignee_user_ids,
      );
      if (!membersOk.ok) {
        return NextResponse.json({ error: membersOk.message }, { status: 400 });
      }
    }

    const startsAt = parsed.value.starts_at ?? (existing.starts_at as string);
    const endsAt =
      "ends_at" in parsed.value
        ? parsed.value.ends_at
        : (existing.ends_at as string | null);
    if (endsAt) {
      const s = new Date(startsAt).getTime();
      const e = new Date(endsAt).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
        return NextResponse.json(
          { error: "Término deve ser após o início." },
          { status: 400 },
        );
      }
    }

    const { assignee_user_ids, ...eventPatch } = parsed.value;
    if (Object.keys(eventPatch).length > 0) {
      const { error } = await ctx.supabase
        .from("agenda_events")
        .update(eventPatch)
        .eq("id", id)
        .eq("account_id", ctx.accountId);
      if (error) {
        console.error("[PATCH /api/agenda/events/id]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (assignee_user_ids) {
      const replaced = await replaceEventAssignees({
        supabase: ctx.supabase,
        accountId: ctx.accountId,
        eventId: id,
        userIds: assignee_user_ids,
      });
      if (!replaced.ok) {
        console.error("[PATCH /api/agenda/events/id] assignees", replaced.message);
        return NextResponse.json({ error: replaced.message }, { status: 500 });
      }
    }

    const { data, error: reloadErr } = await ctx.supabase
      .from("agenda_events")
      .select("*")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .single();
    if (reloadErr) {
      console.error("[PATCH /api/agenda/events/id] reload", reloadErr);
      return NextResponse.json({ error: reloadErr.message }, { status: 500 });
    }

    const [event] = await attachAssigneesToEvents(
      ctx.supabase,
      ctx.accountId,
      [data as Record<string, unknown>],
    );
    return NextResponse.json({ event });
  } catch (err) {
    return toErrorResponse(err);
  }
}
