import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface PinInputProps {
  value: string;
  onChange: (v: string) => void;
}

export function PinInput({ value, onChange }: PinInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function focusCell(i: number) {
    inputs.current[i]?.focus();
  }

  function getDigit(i: number): string {
    return i < value.length ? value[i] : '';
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const arr = Array.from({ length: 4 }, (_, j) => getDigit(j));
    arr[i] = digit;
    onChange(arr.join(''));
    if (digit && i < 3) focusCell(i + 1);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (getDigit(i)) {
        const arr = Array.from({ length: 4 }, (_, j) => getDigit(j));
        arr[i] = '';
        onChange(arr.join('').trimEnd());
      } else if (i > 0) {
        const arr = Array.from({ length: 4 }, (_, j) => getDigit(j));
        arr[i - 1] = '';
        onChange(arr.join('').trimEnd());
        focusCell(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focusCell(i - 1);
    } else if (e.key === 'ArrowRight' && i < 3) {
      focusCell(i + 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    onChange(digits);
    if (digits.length > 0) focusCell(Math.min(digits.length, 3));
  }

  return (
    <div className="flex gap-2" role="group" aria-label="PIN">
      {Array.from({ length: 4 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={getDigit(i)}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          autoComplete={i === 0 ? 'current-password' : 'off'}
          aria-label={`PIN digit ${i + 1}`}
          className={cn(
            'w-12 h-12 text-center text-lg font-mono tracking-widest',
            'rounded-md border border-border bg-surface text-text-primary',
            'focus:outline-none focus-visible:border-primary focus-visible:shadow-glow',
            'caret-transparent',
          )}
        />
      ))}
    </div>
  );
}
