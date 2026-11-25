import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  label,
  unit,
  className,
  size = 'md',
  disabled = false,
}) => {
  const [text, setText] = useState<string>(() =>
    value !== undefined && value !== null ? String(value) : ''
  );

  useEffect(() => {
    if (value !== undefined && value !== null) {
      if (text === '' || Number(text) !== value) {
        setText(String(value));
      }
    }
  }, [value]);

  const commitValue = (valStr: string) => {
    const trimmed = valStr.trim();
    if (!trimmed || isNaN(Number(trimmed))) {
      const fallback = Math.max(min, Math.min(max, value || min));
      setText(String(fallback));
      onChange(fallback);
      return;
    }
    const parsed = Number(trimmed);
    const clamped = Math.max(min, Math.min(max, parsed));
    setText(String(clamped));
    onChange(clamped);
  };

  const handleStep = (delta: number) => {
    if (disabled) return;
    const current = Number(text) || value || 0;
    const next = Math.max(min, Math.min(max, Number((current + delta).toFixed(2))));
    setText(String(next));
    onChange(next);
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-center">
          {label}
        </span>
      )}
      <div
        className={cn(
          'inline-flex items-center rounded-lg border border-slate-200 bg-white transition-colors focus-within:border-[#17664e] focus-within:ring-1 focus-within:ring-[#17664e] shadow-2xs overflow-hidden',
          size === 'sm' ? 'h-8' : 'h-9',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        <button
          type="button"
          onClick={() => handleStep(-step)}
          disabled={disabled || Number(text) <= min}
          className="h-full px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center shrink-0 border-0"
          title="Giảm"
        >
          <Minus className="w-3 h-3" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '' || /^\d*\.?\d*$/.test(v)) {
              setText(v);
              if (v !== '') {
                const num = Number(v);
                if (!isNaN(num) && num >= min && num <= max) {
                  onChange(num);
                }
              }
            }
          }}
          onBlur={() => commitValue(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitValue(text);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              handleStep(step);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              handleStep(-step);
            }
          }}
          style={{
            minHeight: 0,
            height: '100%',
            border: 'none',
            borderRadius: 0,
            padding: 0,
            margin: 0,
            boxShadow: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
          }}
          className={cn(
            'number-stepper-input !min-h-0 !h-full !border-0 !border-none !rounded-none !p-0 !m-0 !bg-transparent !shadow-none !outline-none focus:!ring-0 focus:!outline-none text-center font-bold text-slate-900',
            unit ? 'w-8 pr-0.5' : 'w-9',
            size === 'sm' ? 'text-xs' : 'text-xs'
          )}
        />

        {unit && (
          <span className="text-[10px] text-slate-400 font-semibold pr-1.5 select-none shrink-0">
            {unit}
          </span>
        )}

        <button
          type="button"
          onClick={() => handleStep(step)}
          disabled={disabled || Number(text) >= max}
          className="h-full px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center shrink-0 border-0"
          title="Tăng"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
