import { NextResponse } from "next/server";

import type { AccountContext } from "@/lib/auth/account";
import { isUuid } from "@/lib/instructors/link-user";

/** Carrega ficha do instrutor na conta ou responde 404/400. */
export async function loadInstructorInAccount(
  ctx: AccountContext,
  id: string,
): Promise<
  | { ok: true; instructor: { id: string; user_id: string | null } }
  | { ok: false; response: NextResponse }
> {
  if (!isUuid(id)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "ID inválido" }, { status: 400 }),
    };
  }
  const { data, error } = await ctx.supabase
    .from("instructors")
    .select("id, user_id")
    .eq("account_id", ctx.accountId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[loadInstructorInAccount]", error);
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Instrutor não encontrado" },
        { status: 404 },
      ),
    };
  }
  return { ok: true, instructor: data };
}

/** Resolve a ficha do caller (role instructor) via user_id. */
export async function loadOwnInstructor(
  ctx: AccountContext,
): Promise<
  | { ok: true; instructor: { id: string; user_id: string } }
  | { ok: false; response: NextResponse }
> {
  const { data, error } = await ctx.supabase
    .from("instructors")
    .select("id, user_id")
    .eq("account_id", ctx.accountId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) {
    console.error("[loadOwnInstructor]", error);
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!data || !data.user_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Nenhuma ficha de instrutor vinculada a este usuário" },
        { status: 404 },
      ),
    };
  }
  return {
    ok: true,
    instructor: { id: data.id, user_id: data.user_id },
  };
}

export async function replaceWeekly(
  ctx: AccountContext,
  instructorId: string,
  weekdays: number[],
): Promise<{ error: string | null }> {
  const { error: delErr } = await ctx.supabase
    .from("instructor_weekly_availability")
    .delete()
    .eq("account_id", ctx.accountId)
    .eq("instructor_id", instructorId);

  if (delErr) return { error: delErr.message };

  if (weekdays.length === 0) return { error: null };

  const rows = weekdays.map((weekday) => ({
    account_id: ctx.accountId,
    instructor_id: instructorId,
    weekday,
    active: true,
  }));

  const { error: insErr } = await ctx.supabase
    .from("instructor_weekly_availability")
    .insert(rows);

  return { error: insErr?.message ?? null };
}

export async function replaceLocations(
  ctx: AccountContext,
  instructorId: string,
  locationIds: string[],
): Promise<{ error: string | null }> {
  const { error: delErr } = await ctx.supabase
    .from("instructor_locations")
    .delete()
    .eq("account_id", ctx.accountId)
    .eq("instructor_id", instructorId);

  if (delErr) return { error: delErr.message };

  if (locationIds.length === 0) return { error: null };

  const rows = locationIds.map((location_id) => ({
    account_id: ctx.accountId,
    instructor_id: instructorId,
    location_id,
    active: true,
  }));

  const { error: insErr } = await ctx.supabase
    .from("instructor_locations")
    .insert(rows);

  return { error: insErr?.message ?? null };
}
