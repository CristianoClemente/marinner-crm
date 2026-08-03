import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { generateAtestadoForEnrollment } from "@/lib/documents/generate";
import type { HabilitationKind } from "@/lib/documents/types";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const { id: classId } = await context.params;
    if (!isUuid(classId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => ({}));
    const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const { data: enrollments, error } = await ctx.supabase
      .from("process_class_enrollments")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("class_id", classId);

    if (error) {
      console.error("[POST /api/classes/id/documents/atestados]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = enrollments ?? [];
    if (list.length === 0) {
      return NextResponse.json(
        { error: "Turma sem alunos alocados." },
        { status: 400 },
      );
    }

    const genCtx = {
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      userId: ctx.userId,
      accountName: ctx.account?.name?.trim() || "Escola",
    };

    const habilitation: HabilitationKind | null =
      b.habilitation === "arrais" || b.habilitation === "motonauta"
        ? b.habilitation
        : null;

    const results: {
      enrollmentId: string;
      ok: boolean;
      documentId?: string;
      error?: string;
      gaps?: string[];
    }[] = [];

    for (const row of list) {
      const result = await generateAtestadoForEnrollment({
        ctx: genCtx,
        classId,
        enrollmentId: row.id,
        trainingHoursLabel:
          typeof b.trainingHoursLabel === "string"
            ? b.trainingHoursLabel
            : undefined,
        theoreticalMinutes:
          typeof b.theoreticalMinutes === "number"
            ? b.theoreticalMinutes
            : undefined,
        practicalMinutes:
          typeof b.practicalMinutes === "number" ? b.practicalMinutes : undefined,
        habilitationOverride: habilitation,
      });
      if (result.ok) {
        results.push({
          enrollmentId: row.id,
          ok: true,
          documentId: result.document.id,
        });
      } else {
        results.push({
          enrollmentId: row.id,
          ok: false,
          error: result.error,
          gaps: result.gaps,
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      results,
      okCount,
      failCount: results.length - okCount,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
