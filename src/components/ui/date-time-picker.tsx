"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { ptBR } from "react-day-picker/locale";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function parseLocal(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function timePart(date: Date | undefined): string {
  if (!date) return "09:00";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface DateTimePickerProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  timeLabel?: string;
  id?: string;
}

/**
 * Seletor de data + hora no padrão shadcn (Calendar + Popover + hora).
 * `value`/`onChange` usam o mesmo formato de `datetime-local` (local sem Z).
 */
export function DateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = "Selecionar data e hora",
  timeLabel = "Hora",
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseLocal(value);

  function applyDate(day: Date | undefined) {
    if (!day) return;
    const next = new Date(day);
    if (selected) {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      next.setHours(9, 0, 0, 0);
    }
    onChange(toLocalValue(next));
  }

  function applyTime(time: string) {
    if (!time) return;
    const [hRaw, mRaw] = time.split(":");
    const h = Number(hRaw);
    const m = Number(mRaw);
    const base = selected ? new Date(selected) : new Date();
    if (!selected) {
      // Mantém o dia de hoje se ainda não há data.
      base.setSeconds(0, 0);
    }
    base.setHours(
      Number.isFinite(h) ? h : 0,
      Number.isFinite(m) ? m : 0,
      0,
      0,
    );
    onChange(toLocalValue(base));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!selected}
            className={cn(
              "w-full justify-start border-input bg-transparent font-normal dark:bg-input/30 dark:hover:bg-input/50",
              "data-[empty=true]:text-muted-foreground",
            )}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {selected ? formatDateTime(selected) : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 bg-popover p-0">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          onSelect={applyDate}
          captionLayout="dropdown"
          defaultMonth={selected}
          className="bg-transparent"
        />
        <div className="flex items-center gap-2 border-t border-border bg-popover px-3 py-2.5">
          <Label
            htmlFor={`${id ?? "dt"}-time`}
            className="shrink-0 text-xs font-medium text-muted-foreground"
          >
            {timeLabel}
          </Label>
          <Input
            id={`${id ?? "dt"}-time`}
            type="time"
            value={timePart(selected)}
            onChange={(e) => applyTime(e.target.value)}
            disabled={disabled}
            className="h-8 bg-transparent dark:bg-input/30"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
