"use client";

import { useTranslations } from "next-intl";
import { Check, CircleSlash } from "lucide-react";

import type { ProcessStatus } from "@/types";
import { Badge } from "@/components/ui/badge";

const VARIANT = {
  active: "outline",
  completed: "secondary",
  canceled: "destructive",
} as const;

export function ProcessStatusBadge({ status }: { status: ProcessStatus }) {
  const t = useTranslations("Processes.status");

  return (
    <Badge variant={VARIANT[status]}>
      {status === "completed" ? <Check aria-hidden /> : null}
      {status === "canceled" ? <CircleSlash aria-hidden /> : null}
      {t(status)}
    </Badge>
  );
}
