import { useEffect, useState, type ReactNode } from 'react';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: ReactNode;
}

export function NumberField({ label, value, onChange, suffix, step = 1, min, max, hint }: NumberFieldProps) {
  // Local text state so partially typed values ("3.", "") don't get clobbered.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]);

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          inputMode="decimal"
          value={text}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: ReactNode;
}

export function SelectField<T extends string>({ label, value, options, onChange, hint }: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="field check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
