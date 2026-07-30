import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { getChatStorageSnapshot } from "@/lib/storage/chat-media-registry";
import { formatBytesPt } from "@/lib/storage/chat-quota";

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const snap = await getChatStorageSnapshot(ctx.supabase, ctx.accountId);
    return NextResponse.json({
      ...snap,
      usedLabel: formatBytesPt(snap.usedBytes),
      quotaLabel: formatBytesPt(snap.quotaBytes),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
