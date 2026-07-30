"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import type {
  ClassLocation,
  ClassLocationBonusRule,
  ClassLocationCostType,
  ClassLocationStatus,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COST_TYPES: ClassLocationCostType[] = [
  "monthly_fee",
  "per_class",
  "per_day",
  "per_student",
];

const FORM_ID = "class-location-form";

interface ClassLocationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: ClassLocation | null;
  onSaved: () => void;
}

export function ClassLocationForm({
  open,
  onOpenChange,
  location,
  onSaved,
}: ClassLocationFormProps) {
  const t = useTranslations("ClassLocations.form");
  const isEdit = !!location;

  const [name, setName] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState<ClassLocationStatus>("active");
  const [hasExpense, setHasExpense] = useState(false);
  const [expenseType, setExpenseType] =
    useState<ClassLocationCostType>("monthly_fee");
  const [expenseAmount, setExpenseAmount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<ClassLocationBonusRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [bonusType, setBonusType] =
    useState<ClassLocationCostType>("per_student");
  const [bonusAmount, setBonusAmount] = useState("0");
  const [bonusStarts, setBonusStarts] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [bonusEnds, setBonusEnds] = useState("");
  const [addingBonus, setAddingBonus] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (location) {
      setName(location.name);
      setEndereco(location.endereco ?? "");
      setNumero(location.numero ?? "");
      setComplemento(location.complemento ?? "");
      setBairro(location.bairro ?? "");
      setCidade(location.cidade ?? "");
      setEstado(location.estado ?? "");
      setCep(location.cep ?? "");
      setStatus(location.status);
      setHasExpense(location.has_expense);
      setExpenseType(location.expense_type ?? "monthly_fee");
      setExpenseAmount(
        location.expense_amount != null
          ? String(location.expense_amount)
          : "0",
      );
      setRulesLoading(true);
      let cancelled = false;
      void (async () => {
        try {
          const res = await fetch(
            `/api/class-locations/${location.id}/bonus-rules`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || t("bonusLoadError"));
          if (!cancelled) setRules(data.rules ?? []);
        } catch (err) {
          if (!cancelled) {
            toast.error(
              err instanceof Error ? err.message : t("bonusLoadError"),
            );
            setRules([]);
          }
        } finally {
          if (!cancelled) setRulesLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    setName("");
    setEndereco("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstado("");
    setCep("");
    setStatus("active");
    setHasExpense(false);
    setExpenseType("monthly_fee");
    setExpenseAmount("0");
    setRules([]);
  }, [open, location, t]);

  async function reloadRules(locationId: string) {
    setRulesLoading(true);
    try {
      const res = await fetch(
        `/api/class-locations/${locationId}/bonus-rules`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("bonusLoadError"));
      setRules(data.rules ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bonusLoadError"));
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }

  function costLabel(type: ClassLocationCostType) {
    switch (type) {
      case "monthly_fee":
        return t("costMonthly");
      case "per_class":
        return t("costPerClass");
      case "per_day":
        return t("costPerDay");
      case "per_student":
        return t("costPerStudent");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        endereco: endereco || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        cep: cep || null,
        status,
        has_expense: hasExpense,
        expense_type: hasExpense ? expenseType : null,
        expense_amount: hasExpense ? Number(expenseAmount) : null,
      };

      if (isEdit && location) {
        const res = await fetch(`/api/class-locations/${location.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("saveError"));
        toast.success(t("saved"));
      } else {
        const res = await fetch("/api/class-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("saveError"));
        toast.success(t("created"));
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function addBonusRule() {
    if (!location) return;
    setAddingBonus(true);
    try {
      const res = await fetch(
        `/api/class-locations/${location.id}/bonus-rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bonus_type: bonusType,
            bonus_amount: Number(bonusAmount),
            starts_on: bonusStarts,
            ends_on: bonusEnds || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("bonusSaveError"));
      toast.success(t("bonusCreated"));
      setBonusAmount("0");
      setBonusEnds("");
      void reloadRules(location.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bonusSaveError"));
    } finally {
      setAddingBonus(false);
    }
  }

  async function deactivateRule(ruleId: string) {
    if (!location) return;
    try {
      const res = await fetch(
        `/api/class-locations/${location.id}/bonus-rules/${ruleId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("bonusSaveError"));
      toast.success(t("bonusDeactivated"));
      void reloadRules(location.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bonusSaveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
        </DialogHeader>

        <form
          id={FORM_ID}
          onSubmit={(e) => void handleSubmit(e)}
          className="max-h-[60dvh] space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <div className="space-y-1.5">
            <Label htmlFor="loc-name">{t("name")}</Label>
            <Input
              id="loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="text-base md:text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="loc-endereco">{t("endereco")}</Label>
              <Input
                id="loc-endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-numero">{t("numero")}</Label>
              <Input
                id="loc-numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="loc-bairro">{t("bairro")}</Label>
              <Input
                id="loc-bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-complemento">{t("complemento")}</Label>
              <Input
                id="loc-complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="loc-cidade">{t("cidade")}</Label>
              <Input
                id="loc-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-estado">{t("estado")}</Label>
              <Input
                id="loc-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-cep">{t("cep")}</Label>
              <Input
                id="loc-cep"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                className="text-base md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("status")}</Label>
            <Select
              value={status}
              onValueChange={(v) =>
                setStatus((v as ClassLocationStatus) ?? "active")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {status === "active" ? t("statusActive") : t("statusInactive")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("statusActive")}</SelectItem>
                <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t("hasExpense")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("hasExpenseHint")}
              </p>
            </div>
            <Switch
              checked={hasExpense}
              onCheckedChange={setHasExpense}
              aria-label={t("hasExpense")}
            />
          </div>

          {hasExpense && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("expenseType")}</Label>
                <Select
                  value={expenseType}
                  onValueChange={(v) =>
                    setExpenseType((v as ClassLocationCostType) ?? "monthly_fee")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{costLabel(expenseType)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COST_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {costLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-expense-amount">{t("expenseAmount")}</Label>
                <Input
                  id="loc-expense-amount"
                  type="text"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="text-base tabular-nums md:text-sm"
                />
              </div>
            </div>
          )}

          {isEdit && location && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">
                {t("bonusTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("bonusHint")}</p>

              {rulesLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {rules.length === 0 ? (
                    <li className="px-3 py-2.5 text-sm text-muted-foreground">
                      {t("bonusEmpty")}
                    </li>
                  ) : (
                    rules.map((rule) => (
                      <li
                        key={rule.id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            {costLabel(rule.bonus_type)} ·{" "}
                            {formatCurrency(rule.bonus_amount)}
                            {!rule.active && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {t("bonusInactive")}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(rule.starts_on)}
                            {rule.ends_on
                              ? ` → ${formatDate(rule.ends_on)}`
                              : ` → ${t("bonusOpenEnded")}`}
                          </p>
                        </div>
                        {rule.active && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("bonusDeactivate")}
                            onClick={() => void deactivateRule(rule.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("bonusType")}</Label>
                  <Select
                    value={bonusType}
                    onValueChange={(v) =>
                      setBonusType(
                        (v as ClassLocationCostType) ?? "per_student",
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{costLabel(bonusType)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COST_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {costLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bonus-amount">{t("bonusAmount")}</Label>
                  <Input
                    id="bonus-amount"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    className="text-base tabular-nums md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bonus-starts">{t("bonusStarts")}</Label>
                  <Input
                    id="bonus-starts"
                    type="date"
                    value={bonusStarts}
                    onChange={(e) => setBonusStarts(e.target.value)}
                    className="text-base md:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bonus-ends">{t("bonusEnds")}</Label>
                  <Input
                    id="bonus-ends"
                    type="date"
                    value={bonusEnds}
                    onChange={(e) => setBonusEnds(e.target.value)}
                    className="text-base md:text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={addingBonus}
                onClick={() => void addBonusRule()}
              >
                {addingBonus ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t("bonusAdd")}
              </Button>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
