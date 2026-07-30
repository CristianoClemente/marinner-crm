import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  clampExpiryDays,
  generateInviteToken,
  inviteExpiresAt,
  inviteUrl,
} from "@/lib/auth/invitations";
import { getApexUrl, getTenantUrl } from "@/lib/domain";
import { isUuid } from "@/lib/instructors/link-user";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

type RouteCtx = { params: Promise<{ id: string }> };

const MAX_LABEL_LEN = 80;

function resolveBaseUrl(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  const host = request.headers.get("host")?.trim();
  if (host) {
    const reqProto = new URL(request.url).protocol.replace(":", "");
    return `${reqProto}://${host}`;
  }

  return getApexUrl();
}

/**
 * Cria convite com role `instructor`.
 * O vínculo `instructors.user_id` é feito depois (manual via link-user).
 * O label grava `instructor:{id}` para o admin identificar a ficha.
 */
export async function POST(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const limit = checkRateLimit(
      `admin:instructorInvite:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { data: instructor, error: instErr } = await ctx.supabase
      .from("instructors")
      .select("id, full_name, user_id")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (instErr) {
      console.error("[POST /api/instructors/id/invite] load", instErr);
      return NextResponse.json({ error: instErr.message }, { status: 500 });
    }
    if (!instructor) {
      return NextResponse.json(
        { error: "Instrutor não encontrado" },
        { status: 404 },
      );
    }
    if (instructor.user_id) {
      return NextResponse.json(
        {
          error: "Este instrutor já possui usuário vinculado",
          code: "instructor_already_linked",
        },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      expiresInDays?: unknown;
      label?: unknown;
    } | null;

    const expiresInDaysRaw = body?.expiresInDays;
    const expiresInDays =
      typeof expiresInDaysRaw === "number" ? expiresInDaysRaw : undefined;
    const expiryDays = clampExpiryDays(expiresInDays);
    const expiresAt = inviteExpiresAt(expiryDays);

    // Label padrão aponta para a ficha; UI documenta o link-user pós-aceite.
    let label = `instructor:${id}`;
    if (typeof body?.label === "string") {
      const trimmed = body.label.trim();
      if (trimmed.length > MAX_LABEL_LEN) {
        return NextResponse.json(
          { error: `Label must be ${MAX_LABEL_LEN} characters or fewer` },
          { status: 400 },
        );
      }
      if (trimmed) label = trimmed;
    }
    if (label.length > MAX_LABEL_LEN) {
      label = label.slice(0, MAX_LABEL_LEN);
    }

    const { token, hash } = generateInviteToken();

    const { data, error } = await ctx.supabase
      .from("account_invitations")
      .insert({
        account_id: ctx.accountId,
        token_hash: hash,
        role: "instructor",
        created_by_user_id: ctx.userId,
        label,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, role, label, expires_at, created_at")
      .single();

    if (error || !data) {
      console.error("[POST /api/instructors/id/invite] insert", error);
      return NextResponse.json(
        { error: "Falha ao criar convite" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        invitation: data,
        token,
        url: inviteUrl(
          token,
          ctx.account.slug
            ? getTenantUrl(ctx.account.slug)
            : resolveBaseUrl(request),
        ),
        expiresInDays: expiryDays,
        /** Lembrete para a UI: após o aceite, use POST …/link-user. */
        link_after_accept: true,
        instructor_id: id,
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
