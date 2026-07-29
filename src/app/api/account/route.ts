// ============================================================
// /api/account
//
//   GET   — current caller's account + role. Any member.
//   PATCH — update account branding (name / slug / logo_url). Admin+.
// ============================================================

import { NextResponse } from "next/server";

import {
  requireRole,
  getCurrentAccount,
  toErrorResponse,
} from "@/lib/auth/account";
import { validateSlug } from "@/lib/account/slug";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

const ACCOUNT_SELECT = "id, name, slug, logo_url" as const;
const MAX_NAME_LEN = 80;

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    return NextResponse.json({
      account: ctx.account,
      role: ctx.role,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

type PatchBody = {
  name?: unknown;
  slug?: unknown;
  logo_url?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole("admin");

    const limit = checkRateLimit(
      `admin:account:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = (await request.json().catch(() => null)) as PatchBody | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const patch: {
      name?: string;
      slug?: string | null;
      logo_url?: string | null;
    } = {};

    if ("name" in body) {
      if (typeof body.name !== "string") {
        return NextResponse.json(
          { error: "'name' deve ser uma string" },
          { status: 400 },
        );
      }
      const name = body.name.trim();
      if (name.length === 0) {
        return NextResponse.json(
          { error: "O nome da escola não pode ficar vazio" },
          { status: 400 },
        );
      }
      if (name.length > MAX_NAME_LEN) {
        return NextResponse.json(
          {
            error: `O nome deve ter no máximo ${MAX_NAME_LEN} caracteres`,
          },
          { status: 400 },
        );
      }
      patch.name = name;
    }

    if ("slug" in body) {
      // null ou "" limpa o slug (ainda opcional na Fatia 1).
      if (body.slug === null || body.slug === "") {
        patch.slug = null;
      } else if (typeof body.slug !== "string") {
        return NextResponse.json(
          { error: "'slug' deve ser uma string" },
          { status: 400 },
        );
      } else {
        const result = validateSlug(body.slug);
        if (!result.ok) {
          const messages: Record<string, string> = {
            empty: "Informe um slug",
            too_short: "O slug precisa ter pelo menos 3 caracteres",
            too_long: "O slug deve ter no máximo 48 caracteres",
            invalid_format:
              "Use apenas letras minúsculas, números e hífens (sem começar/terminar com hífen)",
            reserved: "Este slug é reservado pelo sistema",
          };
          return NextResponse.json(
            { error: messages[result.error ?? "invalid_format"] },
            { status: 400 },
          );
        }
        patch.slug = result.slug;
      }
    }

    if ("logo_url" in body) {
      if (body.logo_url === null || body.logo_url === "") {
        patch.logo_url = null;
      } else if (typeof body.logo_url !== "string") {
        return NextResponse.json(
          { error: "'logo_url' deve ser uma string ou null" },
          { status: 400 },
        );
      } else {
        const url = body.logo_url.trim();
        if (!/^https?:\/\//i.test(url)) {
          return NextResponse.json(
            { error: "URL do logotipo inválida" },
            { status: 400 },
          );
        }
        if (url.length > 2048) {
          return NextResponse.json(
            { error: "URL do logotipo muito longa" },
            { status: 400 },
          );
        }
        patch.logo_url = url;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar" },
        { status: 400 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("accounts")
      .update(patch)
      .eq("id", ctx.accountId)
      .select(ACCOUNT_SELECT)
      .single();

    if (error) {
      // unique_violation on slug
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Este slug já está em uso por outra escola" },
          { status: 409 },
        );
      }
      console.error("[PATCH /api/account] update error:", error);
      return NextResponse.json(
        { error: "Falha ao atualizar a conta" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      account: {
        id: data.id,
        name: data.name,
        slug: data.slug ?? null,
        logo_url: data.logo_url ?? null,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
