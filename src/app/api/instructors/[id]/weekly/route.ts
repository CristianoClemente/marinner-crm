import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  loadInstructorInAccount,
  replaceWeekly,
} from "@/lib/instructors/api-helpers";
import { validateWeeklyReplace } from "@/lib/instructors/validate";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const loaded = await loadInstructorInAccount(ctx, id);
    if (!loaded.ok) return loaded.response;

    const { data, error } = await ctx.supabase
      .from("instructor_weekly_availability")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("instructor_id", id)
      .order("weekday", { ascending: true });

    if (error) {
      console.error("[GET /api/instructors/id/weekly]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ weekly: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const loaded = await loadInstructorInAccount(ctx, id);
    if (!loaded.ok) return loaded.response;

    const body = await request.json().catch(() => null);
    const parsed = validateWeeklyReplace(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const replaced = await replaceWeekly(ctx, id, parsed.value.weekdays);
    if (replaced.error) {
      console.error("[PUT /api/instructors/id/weekly]", replaced.error);
      return NextResponse.json({ error: replaced.error }, { status: 500 });
    }

    const { data, error } = await ctx.supabase
      .from("instructor_weekly_availability")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("instructor_id", id)
      .order("weekday", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ weekly: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
