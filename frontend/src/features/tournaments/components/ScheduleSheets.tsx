import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useOpened } from '@/shared/hooks/useSearch';
import { Platform } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Button, RadioCard, Row, Sheet, T } from '@/shared/ui';
import { parseDay } from '@/shared/utils/format';
import type { Tournament } from '../types';

/** Pick a court for a fixture. */
export function CourtPickerSheet({ visible, courts, current, onPick, onClose }: { visible: boolean; courts: Tournament['courts']; current: string | null; onPick: (courtId: string | null) => void; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      <T size={20} w={700}>
        Pick court
      </T>
      {courts.map((c) => (
        <RadioCard key={c.id} title={c.name} subtitle={c.scorers.length ? `Scorer: ${c.scorers.map((s) => s.name).join(', ')}` : 'Scorer: any staff'} selected={c.id === current} background={colors.bg} onPress={() => onPick(c.id)} />
      ))}
      {!courts.length ? (
        <T size={14} color={colors.muted}>
          Add courts under Staff & courts first.
        </T>
      ) : null}
      {current ? <Button label="Clear court" variant="outline" onPress={() => onPick(null)} /> : null}
    </Sheet>
  );
}

/** Pick a start time on `day` (YYYY-MM-DD). Returns an ISO timestamp. */
export function TimePickerSheet({ visible, day, current, onPick, onClose }: { visible: boolean; day: string; current: string | null; onPick: (iso: string | null) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const initial = () => {
    const d = current ? new Date(current) : parseDay(day);
    if (!current) d.setHours(9, 0, 0, 0);
    return d;
  };
  const [value, setValue] = useState(initial);
  if (useOpened(visible)) setValue(initial());
  const pick = (d: Date) => {
    const out = parseDay(day);
    out.setHours(d.getHours(), d.getMinutes(), 0, 0);
    onPick(out.toISOString());
  };
  if (Platform.OS === 'android') {
    // Android shows its own dialog; no sheet around it.
    return visible ? (
      <DateTimePicker
        value={value}
        mode="time"
        minuteInterval={5}
        onChange={(event, d) => {
          onClose();
          if (event.type === 'set' && d) pick(d);
        }}
      />
    ) : null;
  }
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T size={20} w={700}>
        Pick time
      </T>
      <DateTimePicker value={value} mode="time" display="spinner" minuteInterval={5} onChange={(_, d) => d && setValue(d)} textColor={colors.fg} />
      <Row gap={10}>
        {current ? <Button label="Clear" variant="raised" style={{ flex: 1 }} onPress={() => onPick(null)} /> : null}
        <Button label="Set time" style={{ flex: 1 }} onPress={() => pick(value)} />
      </Row>
    </Sheet>
  );
}
