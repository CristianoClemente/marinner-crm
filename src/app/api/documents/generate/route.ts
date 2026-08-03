import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  generateAtestadoForEnrollment,
  generateRequerimento,
  generateResidencia,
} from "@/lib/documents/generate";
import { isDocumentKind } from "@/lib/documents/types";
import { isUuid } from "@/lib/processes/validate";

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const kind = typeof b.kind === "string" ? b.kind : "";
    if (!isDocumentKind(kind)) {
      return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
    }

    const accountName = ctx.account?.name?.trim() || "Escola";
    const genCtx = {
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      userId: ctx.userId,
      accountName,
    };

    if (kind === "declaracao_residencia") {
      if (!isUuid(b.contactId)) {
        return NextResponse.json({ error: "contactId inválido." }, { status: 400 });
      }
      const result = await generateResidencia({
        ctx: genCtx,
        contactId: b.contactId,
        processId: isUuid(b.processId) ? b.processId : null,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, gaps: result.gaps },
          { status: result.status },
        );
      }
      return NextResponse.json({ document: result.document }, { status: 201 });
    }

    if (kind === "requerimento_capitania") {
      if (!isUuid(b.processId)) {
        return NextResponse.json({ error: "processId inválido." }, { status: 400 });
      }
      const serviceOption =
        typeof b.serviceOption === "string" ? b.serviceOption : "";
      const serviceDescription =
        typeof b.serviceDescription === "string" ? b.serviceDescription : "";
      const result = await generateRequerimento({
        ctx: genCtx,
        processId: b.processId,
        serviceOption,
        serviceDescription,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, gaps: result.gaps },
          { status: result.status },
        );
      }
      return NextResponse.json({ document: result.document }, { status: 201 });
    }

    // atestados
    if (!isUuid(b.classId) || !isUuid(b.enrollmentId)) {
      return NextResponse.json(
        { error: "classId e enrollmentId são obrigatórios." },
        { status: 400 },
      );
    }
    const result = await generateAtestadoForEnrollment({
      ctx: genCtx,
      classId: b.classId,
      enrollmentId: b.enrollmentId,
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
      habilitationOverride:
        b.habilitation === "arrais" || b.habilitation === "motonauta"
          ? b.habilitation
          : null,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, gaps: result.gaps },
        { status: result.status },
      );
    }
    return NextResponse.json({ document: result.document }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
