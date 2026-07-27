'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Search, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Contact } from '@/types'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (contact: Contact) => void
  /** While parent is opening chat / sending template. */
  busy?: boolean
}

export function NewMessageDialog({
  open,
  onOpenChange,
  onSelect,
  busy = false,
}: Props) {
  const t = useTranslations('Inbox.newMessage')
  const { accountId } = useAuth()
  const [search, setSearch] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadContacts = useCallback(
    async (query: string) => {
      if (!accountId) return
      setLoading(true)
      try {
        const supabase = createClient()
        let q = supabase
          .from('contacts')
          .select('id, user_id, account_id, phone, name, email, avatar_url, created_at, updated_at')
          .eq('account_id', accountId)
          .not('phone', 'is', null)
          .order('name', { ascending: true })
          .limit(40)

        const trimmed = query.trim()
        if (trimmed) {
          q = q.or(
            `name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,email.ilike.%${trimmed}%`,
          )
        }

        const { data, error } = await q
        if (error) throw error
        setContacts((data as Contact[]) || [])
      } catch {
        setContacts([])
      } finally {
        setLoading(false)
      }
    },
    [accountId],
  )

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedId(null)
      return
    }
    void loadContacts('')
  }, [open, loadContacts])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void loadContacts(search)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [search, open, loadContacts])

  function handlePick(contact: Contact) {
    if (busy || !contact.phone) return
    setSelectedId(contact.id)
    onSelect(contact)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            disabled={busy}
            autoFocus
          />
        </div>

        <ScrollArea className="h-72 rounded-md border border-border">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1 px-4 text-center">
              <UserRound className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            <ul className="p-1">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handlePick(contact)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                      'hover:bg-muted disabled:opacity-50',
                      selectedId === contact.id && 'bg-muted',
                    )}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {(contact.name || contact.phone || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {contact.name || t('unnamed')}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                    {busy && selectedId === contact.id && (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
