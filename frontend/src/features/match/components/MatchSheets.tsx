import { useState } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import { usersApi } from '@/features/profile/api/profile.api';
import type { UserSummary } from '@/features/profile/types';
import { useDebounced } from '@/shared/hooks/useCountdown';
import { useOpened, useSearch } from '@/shared/hooks/useSearch';
import { useTheme } from '@/shared/theme';
import { Avatar, Button, D, Icon, type IconName, RadioDot, Row, SearchField, Segmented, Sheet, T, Tap } from '@/shared/ui';
import { shareUrl } from '../api/match.api';
import { unitLabel } from './Scoreboard';
import type { MatchView, ScoreSummary } from '../types';

function MenuRow({ icon, title, sub, onPress, tone = 'normal' }: { icon: IconName; title: string; sub: string; onPress?: () => void; tone?: 'normal' | 'disabled' | 'danger' }) {
  const { colors } = useTheme();
  const fg = tone === 'disabled' ? colors.faint : tone === 'danger' ? colors.bad : colors.fg;
  const subColor = tone === 'danger' ? colors.bad : tone === 'disabled' ? colors.faint : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: tone === 'disabled' }}
      accessibilityLabel={title}
      disabled={tone === 'disabled' || !onPress}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 12, borderRadius: 14, backgroundColor: pressed ? colors.raised2 : 'transparent' })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tone === 'danger' ? 'rgba(255,84,104,0.12)' : tone === 'disabled' ? colors.raised2 : colors.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <T size={15} w={600} color={fg}>
          {title}
        </T>
        <T size={13} color={subColor}>
          {sub}
        </T>
      </View>
    </Pressable>
  );
}

/** "Badminton · 19-18 in game 3". */
function scoreLine(match: MatchView, score: ScoreSummary): string {
  const now = score.sides.map((s) => s.current ?? s.primary).join('-');
  return `${match.sport.name} · ${now} in ${unitLabel(score).toLowerCase()}`;
}

/** ⋯ during scoring: share, add a scorer, retire, walkover (before the first point), abandon. */
export function ScorerMenu({
  visible,
  match,
  score,
  started,
  onClose,
  onAddScorer,
  onRetire,
  onWalkover,
  onAbandon,
}: {
  visible: boolean;
  match: MatchView;
  score: ScoreSummary;
  started: boolean;
  onClose: () => void;
  onAddScorer: () => void;
  onRetire: () => void;
  onWalkover: () => void;
  onAbandon: () => void;
}) {
  const tournament = match.context === 'tournament';
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: 2, paddingHorizontal: 8 }}>
        <T size={18} w={700}>
          Match options
        </T>
        <T size={13} color={useTheme().colors.muted}>
          {scoreLine(match, score)}
        </T>
      </View>
      <View style={{ gap: 2, marginHorizontal: -4 }}>
        <MenuRow icon="share" title="Share live link" sub="Anyone can watch, no app needed" onPress={() => void Share.share({ message: `Watch live: ${match.sides.map((s) => s.name).join(' vs ')}\n${shareUrl(match)}`, url: shareUrl(match) })} />
        <MenuRow icon="personAdd" title="Add a scorer" sub="Hand over scoring to a friend" onPress={onAddScorer} />
        <MenuRow icon="flag" title="A side retired" sub="The other side wins with the score so far" onPress={started ? onRetire : undefined} tone={started ? 'normal' : 'disabled'} />
        <MenuRow icon="ban" title="Walkover" sub="Only before the first point" onPress={started ? undefined : onWalkover} tone={started ? 'disabled' : 'normal'} />
        {tournament ? (
          <MenuRow icon="trash" title="Abandon match" sub="Tournament matches end with a result, a walkover or a retirement" tone="disabled" />
        ) : (
          <MenuRow icon="trash" title="Abandon match" sub="Nobody wins. Not counted in records." tone="danger" onPress={onAbandon} />
        )}
      </View>
      <Button label="Back to scoring" variant="raised" height={52} radius={14} size={15} onPress={onClose} />
    </Sheet>
  );
}

type EndReason = 'retired' | 'no_show' | 'walkover';

/**
 * "End the match early": the side that can't continue. Retired after points were played;
 * walkover or no-show before the first point (or neither side turned up).
 */
export function EndEarlySheet({
  visible,
  match,
  score,
  started,
  initial,
  busy,
  onClose,
  onRetire,
  onWalkover,
}: {
  visible: boolean;
  match: MatchView;
  score: ScoreSummary;
  started: boolean;
  initial: EndReason;
  busy: boolean;
  onClose: () => void;
  onRetire: (side: number) => void;
  onWalkover: (winner: number | null, reason: 'walkover' | 'no_show') => void;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<EndReason>(initial);
  const [side, setSide] = useState<number | null>(null);
  if (useOpened(visible)) {
    setReason(started ? 'retired' : initial === 'retired' ? 'walkover' : initial);
    setSide(null);
  }

  const options = started
    ? [
        { value: 'retired' as const, label: 'Retired' },
        { value: 'no_show' as const, label: 'No-show', disabled: true },
      ]
    : [
        { value: 'walkover' as const, label: 'Walkover' },
        { value: 'no_show' as const, label: 'No-show' },
      ];
  const verb = reason === 'retired' ? 'retired' : reason === 'no_show' ? 'didn’t show' : 'gave a walkover';
  const winner = side === null ? null : side === -1 ? null : 1 - side;
  const tag = reason === 'retired' ? 'RET.' : 'W/O';
  const head = reason === 'retired' ? score.headline : '';

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: 6 }}>
        <D size={34} lh={34} upper>
          End the match early
        </D>
        <T size={14} color={colors.muted}>
          Pick the side that can’t continue.
        </T>
      </View>
      <Segmented options={options} value={reason} onChange={(v) => setReason(v)} tray={colors.bg} height={42} size={14} />
      <View style={{ gap: 8 }}>
        {match.sides.map((s) => {
          const on = side === s.index;
          return (
            <Tap key={s.index} label={`${s.name} ${verb}`} onPress={() => setSide(s.index)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.bg, borderWidth: on ? 1.5 : 1, borderColor: on ? colors.primary : colors.line }}>
              <RadioDot on={on} />
              <View style={{ width: 6, height: 28, borderRadius: 3, backgroundColor: s.index === 0 ? match.sport.accentColor : colors.sideB }} />
              <T size={15} w={600} flex>
                {s.name} {verb}
              </T>
            </Tap>
          );
        })}
        {reason !== 'retired' ? (
          <Tap label="Neither side showed up" onPress={() => setSide(-1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.bg, borderWidth: side === -1 ? 1.5 : 1, borderColor: side === -1 ? colors.primary : colors.line }}>
            <RadioDot on={side === -1} />
            <T size={15} w={600} flex>
              Neither side showed up
            </T>
          </Tap>
        ) : null}
      </View>
      {side !== null ? (
        <View style={{ gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.raised }}>
          <T size={12} w={700} ls={0.08} color={colors.muted}>
            RESULT
          </T>
          <T size={16} w={700}>
            {winner === null ? 'Double walkover · nobody wins' : `${match.sides[winner]!.name} win`}
          </T>
          <D size={20} w={800}>
            {head ? `${head} ` : ''}
            <D size={15} w={800} color={colors.muted}>
              {tag}
            </D>
          </D>
          <T size={13} color={colors.muted}>
            {reason === 'retired' ? 'Counts in records and ratings, labelled Retired.' : 'Counts in records, no rating change.'}
          </T>
        </View>
      ) : null}
      <Row gap={10}>
        <Button label="Cancel" variant="raised" height={54} radius={14} size={15} style={{ flex: 1 }} onPress={onClose} />
        <Button
          label="End match"
          height={54}
          radius={14}
          size={15}
          weight={800}
          style={{ flex: 1 }}
          disabled={side === null}
          loading={busy}
          onPress={() => {
            if (side === null) return;
            if (reason === 'retired') onRetire(side);
            else onWalkover(winner, reason === 'no_show' ? 'no_show' : 'walkover');
          }}
        />
      </Row>
    </Sheet>
  );
}

/** "Add a scorer": search registered players; they can score this match from their phone too. */
export function AddScorerSheet({ visible, busy, onClose, onPick }: { visible: boolean; busy: boolean; onClose: () => void; onPick: (user: UserSummary) => void }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim(), 300);
  const { results: users, loading } = useSearch<UserSummary>(query, (text) => usersApi.search(text).then((r) => r.users));
  if (useOpened(visible)) setQ('');
  return (
    <Sheet visible={visible} onClose={onClose} height="80%">
      <T size={20} w={700}>
        Add a scorer
      </T>
      <T size={13} color={colors.muted}>
        They can score this match from their phone. You can keep scoring too.
      </T>
      <View style={{ flexDirection: 'row' }}>
        <SearchField value={q} onChangeText={setQ} placeholder="Search by name or @username" background={colors.bg} autoFocus />
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      <View>
        {users.map((u) => (
          <Tap key={u.id} label={`Add ${u.fullName} as scorer`} disabled={busy} onPress={() => onPick(u)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Avatar name={u.fullName} id={u.id} photoUrl={u.photoUrl} size={44} />
            <View style={{ flex: 1 }}>
              <T size={15} w={700}>
                {u.fullName}
              </T>
              <T size={13} color={colors.muted}>
                @{u.username}
              </T>
            </View>
            <View style={{ height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center' }}>
              <T size={14} w={700} color={colors.onPrimary}>
                Add
              </T>
            </View>
          </Tap>
        ))}
      </View>
    </Sheet>
  );
}
