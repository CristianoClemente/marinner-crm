import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isDocumentKind } from "@/lib/documents/types";
import { isUuid } from "@/lib/processes/validate";

export async function GET(request: Request) {
  try {
    const ctx = await requireRole("viewer");
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contactId");
    const processId = url.searchParams.get("processId");
    const classId = url.searchParams.get("classId");

    let query = ctx.supabase
      .from("generated_documents")
      .select(
        "id, kind, template_version, contact_id, process_id, class_id, enrollment_id, storage_path, file_name, created_by_user_id, created_at",
      )
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (contactId) {
      if (!isUuid(contactId)) {
        return NextResponse.json({ error: "contactId inválido." }, { status: 400 });
      }
      query = query.eq("contact_id", contactId);
    }
    if (processId) {
      if (!isUuid(processId)) {
        return NextResponse.json({ error: "processId inválido." }, { status: 400 });
      }
      query = query.eq("process_id", processId);
    }
    if (classId) {
      if (!isUuid(classId)) {
        return NextResponse.json({ error: "classId inválido." }, { status: 400 });
      }
      query = query.eq("class_id", classId);
    }

    const kind = url.searchParams.get("kind");
    if (kind) {
      if (!isDocumentKind(kind)) {
        return NextResponse.json({ error: "kind inválido." }, { status: 400 });
      }
      query = query.eq("kind", kind);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/documents]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ documents: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
