'use client';

import type {
  ChangeEventHandler,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

export interface FieldShellProps {
  description?: ReactNode;
  label: string;
}

export function FieldShell({
  children,
  description,
  label,
}: FieldShellProps & { children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold tracking-[-0.02em] text-ink">{label}</span>
      {children}
      {description ? <span className="text-xs leading-6 text-ink-subtle">{description}</span> : null}
    </label>
  );
}

export interface TextFieldProps {
  description?: ReactNode;
  label: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  value: string;
}

export function TextField({ description, label, onChange, placeholder, value }: TextFieldProps) {
  return (
    <FieldShell description={description} label={label}>
      <input
        className="rounded-[1.1rem] border border-outline-soft bg-panel/70 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--mc-color-accent)_18%,transparent)]"
        onChange={onChange}
        placeholder={placeholder}
        value={value}
      />
    </FieldShell>
  );
}

export interface TextAreaFieldProps {
  description?: ReactNode;
  label: string;
  maxLength?: number;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
  value: string;
}

export function TextAreaField({
  description,
  label,
  maxLength,
  onChange,
  placeholder,
  rows = 4,
  value,
}: TextAreaFieldProps) {
  return (
    <FieldShell description={description} label={label}>
      <textarea
        className="min-h-[7rem] rounded-[1.1rem] border border-outline-soft bg-panel/70 px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--mc-color-accent)_18%,transparent)]"
        maxLength={maxLength}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
    </FieldShell>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  description?: ReactNode;
  label: string;
}

export function SelectField({ children, description, label, ...props }: SelectFieldProps) {
  return (
    <FieldShell description={description} label={label}>
      <select
        className="rounded-[1.1rem] border border-outline-soft bg-panel/70 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--mc-color-accent)_18%,transparent)]"
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export interface ToggleFieldProps {
  checked: boolean;
  description?: ReactNode;
  label: string;
  onChange(checked: boolean): void;
}

export function ToggleField({ checked, description, label, onChange }: ToggleFieldProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[1.1rem] border border-outline-soft bg-panel/55 px-4 py-4">
      <div className="grid gap-1">
        <span className="text-sm font-semibold tracking-[-0.02em] text-ink">{label}</span>
        {description ? <span className="text-xs leading-6 text-ink-subtle">{description}</span> : null}
      </div>
      <button
        aria-pressed={checked}
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-accent' : 'bg-outline-soft'
        }`}
        onClick={() => {
          onChange(!checked);
        }}
        type="button"
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </label>
  );
}
