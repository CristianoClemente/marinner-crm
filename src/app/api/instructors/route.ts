import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  isInstructorStatus,
  validateInstructorCreate,
} from "@/lib/instructors/validate";

export async function GET(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status");

    let query = ctx.supabase
      .from("instructors")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("full_name", { ascending: true });

    if (status && isInstructorStatus(status)) {
      query = query.eq("status", status);
    }
    if (q) {
      query = query.or(
        `full_name.ilike.%${q}%,cha_number.ilike.%${q}%,phone.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/instructors]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (data ?? []).map((row) => row.id);
    const countByInstructor = new Map<string, number>();
    if (ids.length > 0) {
      const { data: locs, error: locErr } = await ctx.supabase
        .from("instructor_locations")
        .select("instructor_id")
        .eq("account_id", ctx.accountId)
        .eq("active", true)
        .in("instructor_id", ids);

      if (locErr) {
        console.error("[GET /api/instructors] locations", locErr);
        return NextResponse.json({ error: locErr.message }, { status: 500 });
      }
      for (const row of locs ?? []) {
        countByInstructor.set(
          row.instructor_id,
          (countByInstructor.get(row.instructor_id) ?? 0) + 1,
        );
      }
    }

    const instructors = (data ?? []).map((row) => ({
      ...row,
      locations_count: countByInstructor.get(row.id) ?? 0,
    }));

    return NextResponse.json({ instructors });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateInstructorCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructors")
      .insert({
        account_id: ctx.accountId,
        user_id: null,
        ...parsed.value,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[POST /api/instructors]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ instructor: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
