import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid } from "@/lib/instructors/link-user";
import {
  filterAvailableInstructors,
  parseDateParam,
  type AvailableCandidate,
} from "@/lib/instructors/resolve-available";
import type { InstructorStatus } from "@/lib/instructors/validate";

/**
 * Instrutores disponíveis em uma data (e opcionalmente local).
 * Admin+ — agenda de aulas consumirá depois.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const url = new URL(request.url);
    const on = parseDateParam(url.searchParams.get("on"));
    if (!on) {
      return NextResponse.json(
        { error: "Parâmetro on=YYYY-MM-DD é obrigatório" },
        { status: 400 },
      );
    }

    const locationRaw = url.searchParams.get("location_id");
    const locationId =
      locationRaw === null || locationRaw === ""
        ? null
        : isUuid(locationRaw)
          ? locationRaw
          : null;
    if (locationRaw && !locationId) {
      return NextResponse.json(
        { error: "location_id inválido" },
        { status: 400 },
      );
    }

    const { data: instructors, error: instErr } = await ctx.supabase
      .from("instructors")
      .select("id, full_name, status, cha_expires_on")
      .eq("account_id", ctx.accountId)
      .eq("status", "active");

    if (instErr) {
      console.error("[GET /api/instructors/available] instructors", instErr);
      return NextResponse.json({ error: instErr.message }, { status: 500 });
    }

    const ids = (instructors ?? []).map((i) => i.id);
    if (ids.length === 0) {
      return NextResponse.json({ instructors: [], on, location_id: locationId });
    }

    const [{ data: weekly }, { data: unav }, { data: locs }] = await Promise.all([
      ctx.supabase
        .from("instructor_weekly_availability")
        .select("instructor_id, weekday, active")
        .eq("account_id", ctx.accountId)
        .in("instructor_id", ids)
        .eq("active", true),
      ctx.supabase
        .from("instructor_unavailability")
        .select("instructor_id, on_date")
        .eq("account_id", ctx.accountId)
        .in("instructor_id", ids),
      ctx.supabase
        .from("instructor_locations")
        .select("instructor_id, location_id, active")
        .eq("account_id", ctx.accountId)
        .in("instructor_id", ids)
        .eq("active", true),
    ]);

    const weekdaysBy = new Map<string, number[]>();
    for (const row of weekly ?? []) {
      const list = weekdaysBy.get(row.instructor_id) ?? [];
      list.push(row.weekday);
      weekdaysBy.set(row.instructor_id, list);
    }
    const unavBy = new Map<string, string[]>();
    for (const row of unav ?? []) {
      const list = unavBy.get(row.instructor_id) ?? [];
      list.push(row.on_date);
      unavBy.set(row.instructor_id, list);
    }
    const locsBy = new Map<string, string[]>();
    for (const row of locs ?? []) {
      const list = locsBy.get(row.instructor_id) ?? [];
      list.push(row.location_id);
      locsBy.set(row.instructor_id, list);
    }

    const candidates: AvailableCandidate[] = (instructors ?? []).map((i) => ({
      id: i.id,
      full_name: i.full_name,
      status: i.status as InstructorStatus,
      cha_expires_on: i.cha_expires_on,
      weekdays: weekdaysBy.get(i.id) ?? [],
      unavailableDates: unavBy.get(i.id) ?? [],
      locationIds: locsBy.get(i.id) ?? [],
    }));

    const today = new Date().toISOString().slice(0, 10);
    const available = filterAvailableInstructors({
      on,
      locationId,
      today,
      candidates,
    });

    return NextResponse.json({
      instructors: available,
      on,
      location_id: locationId,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
