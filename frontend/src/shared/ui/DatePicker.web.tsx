import { createElement } from 'react';
import { useTheme } from '@/shared/theme';

interface Props {
  value: Date;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
  minuteInterval?: number;
  /** Same shape as the native picker: `type` is always "set" here. */
  onChange?: (event: { type: 'set' | 'dismissed' }, date?: Date) => void;
  // Native-only props, accepted and ignored.
  display?: string;
  textColor?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Browser version of the native picker: an <input type="date|time">, which opens the phone's own
 * picker in Safari and Chrome. Changes are reported like the native picker's onChange.
 */
export function DatePicker({ value, mode = 'date', minimumDate, maximumDate, minuteInterval, onChange }: Props) {
  const { colors } = useTheme();
  return createElement('input', {
    type: mode,
    value: mode === 'date' ? day(value) : time(value),
    min: mode === 'date' && minimumDate ? day(minimumDate) : undefined,
    max: mode === 'date' && maximumDate ? day(maximumDate) : undefined,
    step: mode === 'time' && minuteInterval ? minuteInterval * 60 : undefined,
    'aria-label': mode === 'date' ? 'Pick a date' : 'Pick a time',
    onChange: (e: { target: { value: string } }) => {
      const raw = e.target.value;
      if (!raw) return;
      const next = new Date(value);
      if (mode === 'date') {
        const [y, m, d] = raw.split('-').map(Number);
        next.setFullYear(y!, m! - 1, d!);
      } else {
        const [h, min] = raw.split(':').map(Number);
        next.setHours(h!, min!, 0, 0);
      }
      onChange?.({ type: 'set' }, next);
    },
    style: {
      height: 48,
      borderRadius: 12,
      border: `1px solid ${colors.line2}`,
      background: colors.surface,
      color: colors.fg,
      fontSize: 16,
      padding: '0 12px',
      colorScheme: 'dark light',
      width: '100%',
      boxSizing: 'border-box',
    },
  });
}
