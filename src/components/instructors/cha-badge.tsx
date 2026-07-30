"use client";

import { useTranslations } from "next-intl";

import { chaAlert } from "@/lib/instructors/alerts";
import { Badge } from "@/components/ui/badge";

interface ChaBadgeProps {
  expiresOn: string;
  today: string;
}

export function ChaBadge({ expiresOn, today }: ChaBadgeProps) {
  const t = useTranslations("Instructors");
  const alert = chaAlert(expiresOn, today);
  if (alert.level === "ok") return null;

  return (
    <Badge
      variant={alert.level === "overdue" ? "destructive" : "secondary"}
      className="text-[10px]"
    >
      {alert.level === "overdue" ? t("alertChaOverdue") : t("alertChaSoon")}
    </Badge>
  );
}
