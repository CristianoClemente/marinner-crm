'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/currency';
import { formatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import type { Contact, Tag, ContactNote, Deal, MessageTemplate } from '@/types';
import {
  TemplatePicker,
  type TemplateSendValues,
} from '@/components/inbox/template-picker';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone,
  Mail,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Save,
  DollarSign,
  LayoutTemplate,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ContactExtendedFields } from '@/components/contacts/contact-extended-fields';
import { usePipelineLabels } from '@/hooks/use-pipeline-labels';
import {
  emptyExtendedFields,
  extendedFieldsFromContact,
  serializeExtendedFields,
  type ContactExtendedFieldsState,
} from '@/lib/contacts/extended-fields';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const t = useTranslations('Contacts.detailView');
  const { stageLabel } = usePipelineLabels();
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Send template — lets the business initiate (or re-open) a conversation
  // with this contact by sending an approved template. The send route
  // find-or-creates the conversation, so no inbound message is required.
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Details tab
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editExtended, setEditExtended] = useState<ContactExtendedFieldsState>(
    emptyExtendedFields,
  );
  const [savingDetails, setSavingDetails] = useState(false);

  // Tags tab
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditExtended(extendedFieldsFromContact(data));
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);

    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchTags();
      fetchNotes();
      fetchDeals();
    }
  }, [open, contactId, fetchContact, fetchTags, fetchNotes, fetchDeals]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (!contactId || !editPhone.trim()) {
      toast.error(t('toastPhoneRequired'));
      return;
    }

    setSavingDetails(true);
    const { error } = await supabase
      .from('contacts')
      .update({
        name: editName.trim() || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        ...serializeExtendedFields(editExtended),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) {
      toast.error(t('toastUpdateFailed'));
    } else {
      toast.success(t('toastUpdated'));
      fetchContact();
      onUpdated();
    }
    setSavingDetails(false);
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);

    try {
      if (isSelected) {
        await deleteContactTag(contactId, tagId);
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
      } else {
        await addContactTag(contactId, tagId);
        setContactTagIds((prev) => [...prev, tagId]);
      }
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toastUpdateFailed'));
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) {
      toast.error(t('toastNotAuthenticated'));
      setSavingNote(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: user.id,
      note_text: newNote.trim(),
    });

    if (error) {
      toast.error(t('toastNoteAddFailed'));
    } else {
      setNewNote('');
      fetchNotes();
      toast.success(t('toastNoteAdded'));
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error(t('toastNoteDeleteFailed'));
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success(t('toastNoteDeleted'));
    }
  }

  async function handleSendTemplate(
    template: MessageTemplate,
    values: TemplateSendValues,
  ) {
    if (!contactId) return;
    setSendingTemplate(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // No conversation_id — the route find-or-creates one for this
          // contact, mirroring the inbox template-send payload otherwise.
          contact_id: contactId,
          message_type: 'template',
          template_name: template.name,
          template_language: template.language,
          template_message_params: {
            body: values.body,
            headerText: values.headerText,
            buttonParams: values.buttonParams,
          },
          template_params: values.body,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = payload?.error || `HTTP ${res.status}`;
        toast.error(t('toastTemplateFailed', { reason }));
        return;
      }

      toast.success(t('toastTemplateSent', { name: template.name }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'erro de rede';
      toast.error(t('toastTemplateFailed', { reason }));
    } finally {
      setSendingTemplate(false);
    }
  }

  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 border-border bg-popover p-0 text-popover-foreground sm:max-w-xl"
        >
          {loading || !contact ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <SheetHeader className="shrink-0 space-y-0 border-b border-border p-0 px-5 py-4 pr-12 text-left">
                <div className="flex items-start gap-3">
                  <Avatar className="size-11 shrink-0 border border-border bg-muted">
                    <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-base font-semibold text-popover-foreground">
                      {contact.name || t('unnamed')}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      {t('contactDetailsDesc')}
                    </SheetDescription>
                    <div className="mt-2 space-y-1">
                      <button
                        type="button"
                        onClick={copyPhone}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Phone className="size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {contact.phone}
                        </span>
                        {copiedPhone ? (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        ) : (
                          <Copy className="size-3.5 shrink-0 opacity-60" />
                        )}
                      </button>
                      {contact.email && (
                        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground">
                          <Mail className="size-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            {contact.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setTemplatePickerOpen(true)}
                  disabled={sendingTemplate}
                  className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {sendingTemplate ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LayoutTemplate className="size-4" />
                  )}
                  {t('sendTemplateBtn')}
                </Button>
              </SheetHeader>

              <Tabs
                defaultValue="details"
                className="flex min-h-0 flex-1 flex-col gap-0"
              >
                <TabsList
                  variant="line"
                  className="h-auto w-full shrink-0 justify-stretch gap-0 rounded-none border-b border-border bg-transparent px-5"
                >
                  {(
                    [
                      ['details', t('tabs.details')],
                      ['tags', t('tabs.tags')],
                      ['notes', t('tabs.notes')],
                      ['deals', t('tabs.deals')],
                    ] as const
                  ).map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex-1 rounded-none px-2 py-2.5 text-xs font-medium text-muted-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent
                  value="details"
                  className="mt-0 flex-1 overflow-y-auto px-5 py-4"
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('name')}
                        </Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9 w-full border-border bg-muted text-sm text-foreground"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('phone')}{' '}
                          <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="h-9 w-full border-border bg-muted text-sm text-foreground"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('email')}
                        </Label>
                        <Input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="h-9 w-full border-border bg-muted text-sm text-foreground"
                        />
                      </div>
                    </div>

                    <ContactExtendedFields
                      idPrefix="cd"
                      compact
                      value={editExtended}
                      onChange={(patch) =>
                        setEditExtended((prev) => ({ ...prev, ...patch }))
                      }
                    />

                    <Button
                      onClick={saveDetails}
                      disabled={savingDetails}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      size="sm"
                    >
                      {savingDetails ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      {t('saveChangesBtn')}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent
                  value="tags"
                  className="mt-0 flex-1 overflow-y-auto px-5 py-4"
                >
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      {t('tagsTab.clickTagDesc')}
                    </p>
                    {allTags.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        {t('tagsTab.noTagsAvailable')}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allTags.map((tag) => {
                          const selected = contactTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              disabled={savingTags}
                              className={`inline-flex cursor-pointer items-center rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                selected
                                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-popover'
                                  : 'opacity-50 hover:opacity-80'
                              }`}
                              style={{
                                backgroundColor: tag.color + '20',
                                color: tag.color,
                              }}
                            >
                              {selected && <Check className="mr-1 size-3" />}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="notes"
                  className="mt-0 flex min-h-0 flex-1 flex-col px-5 py-4"
                >
                  <div className="mb-4 space-y-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder={t('notesTab.placeholder')}
                      className="min-h-18 resize-none border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <Button
                      onClick={addNote}
                      disabled={!newNote.trim() || savingNote}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
                      size="sm"
                    >
                      {savingNote ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      {t('notesTab.save')}
                    </Button>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                    {loadingNotes ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : notes.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        {t('notesTab.noNotes')}
                      </p>
                    ) : (
                      notes.map((note) => (
                        <div
                          key={note.id}
                          className="group rounded-lg border border-border bg-muted/40 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex-1 whitespace-pre-wrap text-sm text-foreground">
                              {note.note_text}
                            </p>
                            <button
                              type="button"
                              onClick={() => deleteNote(note.id)}
                              className="shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {formatDateTime(note.created_at, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="deals"
                  className="mt-0 flex-1 overflow-y-auto px-5 py-4"
                >
                  {loadingDeals ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  ) : deals.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {t('dealsTab.noDeals')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {deals.map((deal) => (
                        <div
                          key={deal.id}
                          className="rounded-lg border border-border bg-muted/40 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {deal.title}
                            </p>
                            {deal.stage && (
                              <span
                                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: `${deal.stage.color}20`,
                                  color: deal.stage.color,
                                }}
                              >
                                {stageLabel(deal.stage.name)}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DollarSign className="size-3" />
                              {formatCurrency(
                                deal.value ?? 0,
                                deal.currency || defaultCurrency,
                              )}
                            </span>
                            {deal.status && deal.status !== 'open' && (
                              <span
                                className={
                                  deal.status === 'won'
                                    ? 'text-primary'
                                    : 'text-red-400'
                                }
                              >
                                {deal.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onSelect={handleSendTemplate}
      />
    </>
  );
}
