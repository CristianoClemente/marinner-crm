import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findOrCreateConversationForContact } from '@/lib/whatsapp/find-or-create-conversation'
import {
  CONVERSATION_SELECT,
  normalizeConversation,
} from '@/lib/inbox/conversations'

/**
 * POST /api/whatsapp/conversations
 * Body: { contact_id: string }
 *
 * Find-or-create the account conversation for a contact and return the
 * hydrated row (same shape as the inbox list). Used by "Nova mensagem"
 * when the account uses Z-API (open chat without sending a template).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const contactId = body?.contact_id as string | undefined
    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json(
        { error: 'contact_id is required' },
        { status: 400 },
      )
    }

    const { data: contactRow, error: contactErr } = await supabase
      .from('contacts')
      .select('id, phone')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .maybeSingle()

    if (contactErr || !contactRow) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (!contactRow.phone) {
      return NextResponse.json(
        { error: 'Contact has no phone number' },
        { status: 400 },
      )
    }

    const conversationId = await findOrCreateConversationForContact(
      supabase,
      accountId,
      user.id,
      contactId,
    )
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Failed to open a conversation for this contact' },
        { status: 500 },
      )
    }

    const { data: raw, error: loadErr } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .single()

    if (loadErr || !raw) {
      return NextResponse.json(
        { error: 'Conversation created but failed to load' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      conversation: normalizeConversation(raw),
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to open conversation' },
      { status: 500 },
    )
  }
}
