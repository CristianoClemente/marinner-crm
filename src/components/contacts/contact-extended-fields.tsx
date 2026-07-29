'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BRAZIL_UFS,
  CONTACT_CATEGORIA_CHA_OPTIONS,
  CONTACT_GENERO_OPTIONS,
  CONTACT_STATUS_OPTIONS,
  type ContactExtendedFieldsState,
} from '@/lib/contacts/extended-fields';
import { cn } from '@/lib/utils';

interface ContactExtendedFieldsProps {
  value: ContactExtendedFieldsState;
  onChange: (patch: Partial<ContactExtendedFieldsState>) => void;
  /** Prefixo de ids para evitar colisão entre dialog e sheet. */
  idPrefix?: string;
  compact?: boolean;
}

/** Sentinela só na lista; nunca é gravado no estado nem exibido no trigger. */
const CLEAR = '__clear__';

function Field({
  label,
  htmlFor,
  className,
  children,
  labelClass,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
  labelClass: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label
        htmlFor={htmlFor}
        title={label}
        className={cn('block w-full items-start', labelClass)}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function OptionalSelect({
  value,
  onChange,
  placeholder,
  emptyLabel,
  options,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  emptyLabel: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Select
      value={value || null}
      onValueChange={(v) => {
        if (!v || v === CLEAR) {
          onChange('');
          return;
        }
        onChange(String(v));
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedLabel ?? null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CLEAR}>{emptyLabel}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ContactExtendedFields({
  value,
  onChange,
  idPrefix = 'ext',
  compact = false,
}: ContactExtendedFieldsProps) {
  const t = useTranslations('Contacts.extendedFields');
  const inputClass = cn(
    'w-full bg-muted border-border text-foreground',
    // `text-base md:text-sm`: abaixo de 16px o Safari no iOS aplica zoom
    // automático ao focar o campo.
    compact ? 'h-8 text-base md:text-sm' : 'placeholder:text-muted-foreground',
  );
  const labelClass = compact
    ? 'text-[11px] font-medium leading-snug text-muted-foreground line-clamp-2 min-h-[1.375rem]'
    : 'text-muted-foreground text-xs';
  const grid2 = 'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2';
  const gridDoc = compact
    ? grid2
    : 'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-3';
  const gridAddress = compact
    ? grid2
    : 'grid grid-cols-6 gap-x-3 gap-y-3';
  const gridCha = compact
    ? grid2
    : 'grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-3';

  function field(
    key: keyof ContactExtendedFieldsState,
    next: string | boolean,
  ) {
    onChange({ [key]: next });
  }

  const statusOptions = CONTACT_STATUS_OPTIONS.map((opt) => ({
    value: opt,
    label: t(`statusOptions.${opt}`),
  }));
  const generoOptions = CONTACT_GENERO_OPTIONS.map((opt) => ({
    value: opt,
    label: t(`generoOptions.${opt}`),
  }));
  const ufOptions = BRAZIL_UFS.map((uf) => ({ value: uf, label: uf }));
  const categoriaChaOptions = CONTACT_CATEGORIA_CHA_OPTIONS.map((opt) => ({
    value: opt,
    label: t(`categoriaChaOptions.${opt}`),
  }));

  return (
    <div className={cn(compact ? 'space-y-5' : 'space-y-6')}>
      <section className={cn(compact ? 'space-y-2.5' : 'space-y-3')}>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sectionPersonal')}
        </h3>
        <div className={grid2}>
          <Field label={t('cpf')} htmlFor={`${idPrefix}-cpf`} labelClass={labelClass}>
            <Input
              id={`${idPrefix}-cpf`}
              value={value.cpf}
              onChange={(e) => field('cpf', e.target.value)}
              placeholder={t('cpfPlaceholder')}
              className={inputClass}
              inputMode="numeric"
            />
          </Field>
          <Field
            label={t('dataNascimento')}
            htmlFor={`${idPrefix}-nasc`}
            labelClass={labelClass}
          >
            <Input
              id={`${idPrefix}-nasc`}
              type="date"
              value={value.data_nascimento}
              onChange={(e) => field('data_nascimento', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t('status')} labelClass={labelClass}>
            <OptionalSelect
              value={value.status}
              onChange={(next) => field('status', next)}
              placeholder={t('statusPlaceholder')}
              emptyLabel={t('optionEmpty')}
              options={statusOptions}
              className={inputClass}
            />
          </Field>
          <Field label={t('genero')} labelClass={labelClass}>
            <OptionalSelect
              value={value.genero}
              onChange={(next) => field('genero', next)}
              placeholder={t('generoPlaceholder')}
              emptyLabel={t('optionEmpty')}
              options={generoOptions}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('profissao')}
            htmlFor={`${idPrefix}-prof`}
            labelClass={labelClass}
            className="sm:col-span-2"
          >
            <Input
              id={`${idPrefix}-prof`}
              value={value.profissao}
              onChange={(e) => field('profissao', e.target.value)}
              placeholder={t('profissaoPlaceholder')}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className={cn(compact ? 'space-y-2.5' : 'space-y-3')}>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sectionDocument')}
        </h3>
        <div className={gridDoc}>
          <Field
            label={t('docNumero')}
            htmlFor={`${idPrefix}-doc-num`}
            labelClass={labelClass}
          >
            <Input
              id={`${idPrefix}-doc-num`}
              value={value.doc_numero}
              onChange={(e) => field('doc_numero', e.target.value)}
              placeholder={t('docNumeroPlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('docOrgao')}
            htmlFor={`${idPrefix}-doc-org`}
            labelClass={labelClass}
          >
            <Input
              id={`${idPrefix}-doc-org`}
              value={value.doc_orgao_emissor}
              onChange={(e) => field('doc_orgao_emissor', e.target.value)}
              placeholder={t('docOrgaoPlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('docDataEmissao')}
            htmlFor={`${idPrefix}-doc-emi`}
            labelClass={labelClass}
            className={compact ? 'sm:col-span-2' : undefined}
          >
            <Input
              id={`${idPrefix}-doc-emi`}
              type="date"
              value={value.doc_data_emissao}
              onChange={(e) => field('doc_data_emissao', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className={cn(compact ? 'space-y-2.5' : 'space-y-3')}>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sectionAddress')}
        </h3>
        <div className={gridAddress}>
          <Field
            label={t('cep')}
            htmlFor={`${idPrefix}-cep`}
            labelClass={labelClass}
            className={compact ? undefined : 'col-span-6 sm:col-span-2'}
          >
            <Input
              id={`${idPrefix}-cep`}
              value={value.cep}
              onChange={(e) => field('cep', e.target.value)}
              placeholder={t('cepPlaceholder')}
              className={inputClass}
              inputMode="numeric"
            />
          </Field>
          <Field
            label={t('endereco')}
            htmlFor={`${idPrefix}-end`}
            labelClass={labelClass}
            className={compact ? undefined : 'col-span-6 sm:col-span-3'}
          >
            <Input
              id={`${idPrefix}-end`}
              value={value.endereco}
              onChange={(e) => field('endereco', e.target.value)}
              placeholder={t('enderecoPlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('numero')}
            htmlFor={`${idPrefix}-num`}
            labelClass={labelClass}
            className={compact ? undefined : 'col-span-6 sm:col-span-1'}
          >
            <Input
              id={`${idPrefix}-num`}
              value={value.numero}
              onChange={(e) => field('numero', e.target.value)}
              placeholder={t('numeroPlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('complemento')}
            htmlFor={`${idPrefix}-comp`}
            labelClass={labelClass}
            className={compact ? undefined : 'col-span-6 sm:col-span-3'}
          >
            <Input
              id={`${idPrefix}-comp`}
              value={value.complemento}
              onChange={(e) => field('complemento', e.target.value)}
              placeholder={t('complementoPlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('bairro')}
            htmlFor={`${idPrefix}-bairro`}
            labelClass={labelClass}
            className={compact ? undefined : 'col-span-6 sm:col-span-3'}
          >
            <Input
              id={`${idPrefix}-bairro`}
              value={value.bairro}
              onChange={(e) => field('bairro', e.target.value)}
              placeholder={t('bairroPlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('cidade')}
            htmlFor={`${idPrefix}-cidade`}
            labelClass={labelClass}
            className={compact ? undefined : 'col-span-6 sm:col-span-4'}
          >
            <Input
              id={`${idPrefix}-cidade`}
              value={value.cidade}
              onChange={(e) => field('cidade', e.target.value)}
              placeholder={t('cidadePlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('estado')}
            labelClass={labelClass}
            className={compact ? undefined : 'col-span-6 sm:col-span-2'}
          >
            <OptionalSelect
              value={value.estado}
              onChange={(next) => field('estado', next)}
              placeholder={t('estadoPlaceholder')}
              emptyLabel={t('optionEmpty')}
              options={ufOptions}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className={cn(compact ? 'space-y-2.5' : 'space-y-3')}>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sectionCha')}
        </h3>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox
            checked={value.possui_cha}
            onCheckedChange={(checked) =>
              field('possui_cha', checked === true)
            }
            aria-label={t('possuiCha')}
          />
          <span className="text-sm text-foreground">{t('possuiCha')}</span>
        </label>
        {value.possui_cha && (
          <div className={gridCha}>
            <Field
              label={t('numeroCha')}
              htmlFor={`${idPrefix}-cha-num`}
              labelClass={labelClass}
            >
              <Input
                id={`${idPrefix}-cha-num`}
                value={value.numero_cha}
                onChange={(e) => field('numero_cha', e.target.value)}
                placeholder={t('numeroChaPlaceholder')}
                className={inputClass}
              />
            </Field>
            <Field label={t('categoriaCha')} labelClass={labelClass}>
              <OptionalSelect
                value={value.categoria_cha}
                onChange={(next) => field('categoria_cha', next)}
                placeholder={t('categoriaChaPlaceholder')}
                emptyLabel={t('optionEmpty')}
                options={categoriaChaOptions}
                className={inputClass}
              />
            </Field>
            <Field
              label={t('vencimentoCha')}
              htmlFor={`${idPrefix}-cha-venc`}
              labelClass={labelClass}
              className={compact ? 'sm:col-span-2' : undefined}
            >
              <Input
                id={`${idPrefix}-cha-venc`}
                type="date"
                value={value.vencimento_cha}
                onChange={(e) => field('vencimento_cha', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </section>
    </div>
  );
}
