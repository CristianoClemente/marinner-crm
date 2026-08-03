import { NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

export async function GET(request: Request) {
  try {
    const { supabase } = await getCurrentAccount();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const uf = url.searchParams.get("uf")?.trim().toUpperCase() ?? "";

    let query = supabase
      .from("maritime_authorities")
      .select(
        "id, sigla, nome, logradouro, cidade, uf, cep, telefone, email",
      )
      .order("uf", { ascending: true })
      .order("sigla", { ascending: true });

    if (uf) {
      query = query.eq("uf", uf);
    }
    if (q) {
      query = query.or(
        `sigla.ilike.%${q}%,nome.ilike.%${q}%,cidade.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/maritime-authorities]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ authorities: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
