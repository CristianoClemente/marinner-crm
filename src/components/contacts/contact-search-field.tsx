"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ContactSearchOption = {
  id: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
};

type ContactSearchFieldProps = {
  contactId: string;
  onContactIdChange: (id: string) => void;
};

function contactLabel(c: ContactSearchOption): string {
  return c.name?.trim() || c.phone?.trim() || c.cpf?.trim() || "Contato";
}

export function ContactSearchField({
  contactId,
  onContactIdChange,
}: ContactSearchFieldProps) {
  const t = useTranslations("Processes.contactSearch");
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<ContactSearchOption[]>([]);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= 2 && !contactId;
  const options = canSearch ? fetched : [];

  useEffect(() => {
    if (!canSearch) return;
    let cancelled = false;
    const supabase = createClient();
    const digits = trimmed.replace(/\D/g, "");
    const parts = [
      `name.ilike.%${trimmed}%`,
      `phone.ilike.%${trimmed}%`,
      `cpf.ilike.%${trimmed}%`,
    ];
    if (digits.length >= 3 && digits !== trimmed) {
      parts.push(`cpf.ilike.%${digits}%`);
    }
    void (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, phone, cpf")
        .or(parts.join(","))
        .order("name", { ascending: true })
        .limit(8);
      if (!cancelled) setFetched((data as ContactSearchOption[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [canSearch, trimmed]);

  return (
    <div className="space-y-1.5">
      <Label>{t("label")}</Label>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onContactIdChange("");
            setFetched([]);
          }}
          placeholder={t("placeholder")}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => {
              setQuery("");
              onContactIdChange("");
              setFetched([]);
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground after:absolute after:-inset-2"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {options.length > 0 ? (
        <ul className="max-h-36 divide-y divide-border overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg ring-1 ring-border">
          {options.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => {
                  onContactIdChange(c.id);
                  setQuery(contactLabel(c));
                  setFetched([]);
                }}
              >
                <span className="text-foreground">{contactLabel(c)}</span>
                {c.name && c.phone ? (
                  <span className="text-muted-foreground"> · {c.phone}</span>
                ) : null}
                {c.cpf ? (
                  <span className="block text-xs text-muted-foreground">
                    CPF {c.cpf}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {contactId ? t("selected") : t("hint")}
      </p>
    </div>
  );
}
