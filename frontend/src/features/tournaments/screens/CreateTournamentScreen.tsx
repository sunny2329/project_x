import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, Field, Header, Label, Notice, RadioCard, Row, Screen, T, Tap } from '@/shared/ui';
import { toDay, weekdayDayMonth } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import type { Visibility } from '../types';

const VISIBILITY: { value: Visibility; title: string; subtitle: string }[] = [
  { value: 'public', title: 'Public', subtitle: 'Listed in Tournaments, anyone can register' },
  { value: 'unlisted', title: 'Unlisted', subtitle: 'Only people with the link' },
  { value: 'private', title: 'Private', subtitle: 'Only staff and players you add' },
];

function nextSaturday(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d;
}

function DateField({ label, value, onChange, minimum }: { label: string; value: Date; onChange: (d: Date) => void; minimum?: Date }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T size={13} w={600} color={colors.muted}>
        {label}
      </T>
      <Tap label={label} onPress={() => setOpen(true)} style={{ height: 52, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, justifyContent: 'center' }}>
        <T size={16} w={600}>
          {weekdayDayMonth(value)}
        </T>
      </Tap>
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          minimumDate={minimum ?? new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, d) => {
            setOpen(Platform.OS === 'ios');
            if (d) onChange(d);
          }}
        />
      ) : null}
    </View>
  );
}

/** "Set up your tournament": name, dates, venue, who can find it. Saved as a draft. */
export default function CreateTournamentScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [start, setStart] = useState(nextSaturday);
  const [end, setEnd] = useState(() => {
    const d = nextSaturday();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [venue, setVenue] = useState('');
  const [fee, setFee] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();

  const create = () =>
    void submit(async () => {
      const { tournament } = await tournamentsApi.create({
        name: name.trim(),
        startsOn: toDay(start),
        endsOn: toDay(end < start ? start : end),
        visibility,
        ...(venue.trim() ? { venueName: venue.trim() } : {}),
        ...(fee.trim() ? { entryFee: fee.trim() } : {}),
      });
      router.replace({ pathname: '/tournament/[id]/manage', params: { id: tournament.id } });
    });

  return (
    <Screen
      gap={16}
      footer={
        <View style={{ gap: 10 }}>
          <T size={13} color={colors.muted} center>
            Saved as a draft. Nobody sees it until you open registration.
          </T>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Button label="Create draft" weight={800} disabled={name.trim().length < 3} loading={submitting} onPress={create} />
        </View>
      }
    >
      <Header icon="close" center={<Label>New tournament</Label>} />
      <D size={42} lh={40} upper accessibilityRole="header">
        Set up your tournament
      </D>

      <Field label="Name" value={name} onChangeText={setName} height={52} maxLength={120} autoFocus error={serverFieldErrors.name} />
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <DateField
          label="Starts"
          value={start}
          onChange={(d) => {
            setStart(d);
            if (end < d) setEnd(d);
          }}
        />
        <DateField label="Ends" value={end} onChange={setEnd} minimum={start} />
      </Row>
      <Field label="Venue" value={venue} onChangeText={setVenue} height={52} size={16} maxLength={120} error={serverFieldErrors.venueName} />
      <Field label="Entry fee per player (optional)" value={fee} onChangeText={setFee} placeholder="Free" height={52} size={16} maxLength={40} />

      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          Who can find it
        </T>
        {VISIBILITY.map((v) => (
          <RadioCard key={v.value} title={v.title} subtitle={v.subtitle} selected={visibility === v.value} onPress={() => setVisibility(v.value)} />
        ))}
      </View>
    </Screen>
  );
}
