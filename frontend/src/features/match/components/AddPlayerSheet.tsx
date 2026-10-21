import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { env } from '@/shared/config/env';
import { useDebounced } from '@/shared/hooks/useCountdown';
import { useOpened, useSearch } from '@/shared/hooks/useSearch';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, Field, IconButton, PhonePrefix, Row, SearchField, Sheet, T, Tap } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { isValidPhone, normalizePhone } from '@/shared/utils/phone';
import { matchApi } from '../api/match.api';
import { fromOption, newGuest, type LineupPlayer } from '../lineup';
import type { PlayerOption, PlayerRef } from '../types';

/** Bottom sheet: find a registered player, reuse a recent guest, or add a new guest (name + optional phone). */
export function AddPlayerSheet({
  visible,
  side,
  sport,
  sportName,
  taken,
  onAdd,
  onClose,
  title,
}: {
  /** Overrides "Add to side A/B". */
  title?: string;
  visible: boolean;
  side: number;
  sport: string;
  sportName: string;
  /** Keys already in the match (hidden from results). */
  taken: string[];
  onAdd: (player: LineupPlayer, option?: PlayerOption) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [guests, setGuests] = useState<PlayerRef[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const query = useDebounced(q.trim(), 300);
  const { results, loading: searching } = useSearch<PlayerOption>(query, (text) => matchApi.searchPlayers(text, sport).then((r) => r.players));

  // A fresh form each time the sheet opens.
  if (useOpened(visible)) {
    setQ('');
    setGuestName('');
    setGuestPhone('');
  }
  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    matchApi.recentGuests().then((r) => !cancelled && setGuests(r.players), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const shown = (query.length >= 2 ? results.map(fromOption) : guests.map((g) => ({ key: g.playerId, displayName: g.displayName, isGuest: true, userId: null, input: { playerId: g.playerId } }) satisfies LineupPlayer)).filter(
    (p) => !taken.includes(p.key),
  );
  const optionFor = (key: string) => results.find((r) => (r.userId ?? r.playerId) === key);
  const phoneOk = !guestPhone.trim() || isValidPhone(guestPhone);

  const add = (p: LineupPlayer) => {
    onAdd(p, optionFor(p.key));
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} height="88%">
      <Row between>
        <T size={20} w={700}>
          {title ?? `Add to side ${side === 0 ? 'A' : 'B'}`}
        </T>
        <IconButton icon="close" label="Close" tone="raised" size={40} radius={20} onPress={onClose} />
      </Row>
      <View style={{ flexDirection: 'row' }}>
        <SearchField value={q} onChangeText={setQ} placeholder="Search players" background={colors.bg} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ gap: 16 }}>
        <View>
          {query.length < 2 && shown.length ? (
            <T size={12} w={700} ls={0.08} upper color={colors.muted} style={{ marginBottom: 4 }}>
              Recent guests
            </T>
          ) : null}
          {searching && !shown.length ? <ActivityIndicator color={colors.primary} /> : null}
          {shown.map((p) => {
            const o = optionFor(p.key);
            const sub = o ? [o.username ? `@${o.username}` : 'Guest', o.rating ? `${sportName} ${Math.round(o.rating)}` : null].filter(Boolean).join(' · ') : 'Guest';
            return (
              <Tap key={p.key} label={`Add ${p.displayName}`} onPress={() => add(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                <Avatar name={p.displayName} id={p.userId ?? p.key} photoUrl={o?.photoUrl} size={44} />
                <View style={{ flex: 1 }}>
                  <T size={15} w={700} numberOfLines={1}>
                    {p.displayName}
                  </T>
                  <T size={13} color={colors.muted} numberOfLines={1}>
                    {sub}
                  </T>
                </View>
                <View style={{ height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center' }}>
                  <T size={14} w={700} color={colors.onPrimary}>
                    Add
                  </T>
                </View>
              </Tap>
            );
          })}
          {query.length >= 2 && !searching && !shown.length ? (
            <T size={14} color={colors.muted}>
              No players match “{query}”. Add them as a guest below.
            </T>
          ) : null}
        </View>

        <View style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ gap: 4 }}>
            <T size={15} w={700}>
              Not on ProjectX? Add a guest
            </T>
            <T size={13} lh={19} color={colors.muted}>
              Add their number and the match moves to their profile when they join.
            </T>
          </View>
          <Field label="Name" value={guestName} onChangeText={setGuestName} height={48} radius={12} size={16} autoCapitalize="words" maxLength={60} />
          <Field
            label="Phone (optional)"
            value={guestPhone}
            onChangeText={setGuestPhone}
            height={48}
            radius={12}
            size={16}
            keyboardType="phone-pad"
            prefix={<PhonePrefix code={env.defaultCountryCode} />}
            error={phoneOk ? null : 'Enter a valid phone number'}
          />
          <Button
            label={guestName.trim() ? `Add ${firstName(guestName)} as a guest` : 'Add as a guest'}
            height={50}
            radius={14}
            size={15}
            weight={700}
            disabled={!guestName.trim() || !phoneOk}
            onPress={() => add(newGuest(guestName.trim(), guestPhone.trim() ? normalizePhone(guestPhone) : null))}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}
