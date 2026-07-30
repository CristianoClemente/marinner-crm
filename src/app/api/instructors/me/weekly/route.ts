import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  toErrorResponse,
} from "@/lib/auth/account";
import { isInstructorRole } from "@/lib/auth/roles";
import {
  loadOwnInstructor,
  replaceWeekly,
} from "@/lib/instructors/api-helpers";
import { validateWeeklyReplace } from "@/lib/instructors/validate";

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    if (!isInstructorRole(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const own = await loadOwnInstructor(ctx);
    if (!own.ok) return own.response;

    const { data, error } = await ctx.supabase
      .from("instructor_weekly_availability")
      .select("*")
      .eq("instructor_id", own.instructor.id)
      .order("weekday", { ascending: true });

    if (error) {
      console.error("[GET /api/instructors/me/weekly]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ weekly: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!isInstructorRole(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const own = await loadOwnInstructor(ctx);
    if (!own.ok) return own.response;

    const body = await request.json().catch(() => null);
    const parsed = validateWeeklyReplace(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const replaced = await replaceWeekly(
      ctx,
      own.instructor.id,
      parsed.value.weekdays,
    );
    if (replaced.error) {
      console.error("[PUT /api/instructors/me/weekly]", replaced.error);
      return NextResponse.json({ error: replaced.error }, { status: 500 });
    }

    const { data, error } = await ctx.supabase
      .from("instructor_weekly_availability")
      .select("*")
      .eq("instructor_id", own.instructor.id)
      .order("weekday", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ weekly: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
