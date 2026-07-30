import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  toErrorResponse,
} from "@/lib/auth/account";
import { isInstructorRole } from "@/lib/auth/roles";
import { loadOwnInstructor } from "@/lib/instructors/api-helpers";
import { validateUnavailabilityCreate } from "@/lib/instructors/validate";

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    if (!isInstructorRole(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const own = await loadOwnInstructor(ctx);
    if (!own.ok) return own.response;

    const { data, error } = await ctx.supabase
      .from("instructor_unavailability")
      .select("*")
      .eq("instructor_id", own.instructor.id)
      .order("on_date", { ascending: true });

    if (error) {
      console.error("[GET /api/instructors/me/unavailability]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ unavailability: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!isInstructorRole(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const own = await loadOwnInstructor(ctx);
    if (!own.ok) return own.response;

    const body = await request.json().catch(() => null);
    const parsed = validateUnavailabilityCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructor_unavailability")
      .insert({
        account_id: ctx.accountId,
        instructor_id: own.instructor.id,
        ...parsed.value,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe indisponibilidade nesta data" },
          { status: 409 },
        );
      }
      console.error("[POST /api/instructors/me/unavailability]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ unavailability: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
