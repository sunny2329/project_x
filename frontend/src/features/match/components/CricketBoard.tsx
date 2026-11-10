import { useState } from 'react';
import { View } from 'react-native';
import { sportText, useTheme, withAlpha } from '@/shared/theme';
import { Button, D, T, Tap } from '@/shared/ui';
import type { PluginEvent, ScoreSummary, ScoringAction } from '../types';

type Extra = 'none' | 'wide' | 'no_ball';

/** "5.2" from the innings display "48/3 (5.2)"; null before the side has batted or for a typed-in total. */
export function oversOf(score: ScoreSummary, sideIndex: number): string | null {
  const innings = score.segments.at(-1)?.children.find((c) => c.display[sideIndex]);
  return innings?.display[sideIndex]?.match(/\((.+)\)/)?.[1] ?? null;
}

/** Both sides' score in the match (or super over), the batting side marked. */
export function CricketScoreboard({ score, names, slug }: { score: ScoreSummary; names: string[]; slug: string }) {
  const { colors } = useTheme();
  const tint = sportText(colors, slug);
  return (
    <View style={{ borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      {[0, 1].map((i) => {
        const side = score.sides[i]!;
        const overs = oversOf(score, i);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: i === 1 ? 1 : 0, borderTopColor: colors.raised }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: side.serving ? tint : 'transparent' }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={16} w={700} color={side.serving ? colors.fg : colors.soft} numberOfLines={1}>
                {names[i]}
              </T>
              <T size={12} color={colors.muted}>
                {side.serving ? 'Batting' : side.primary === '-' ? 'Yet to bat' : overs ? `${overs} overs` : ''}
              </T>
            </View>
            <D size={46} lh={46} color={side.serving ? tint : colors.fg}>
              {side.primary === '-' ? '–' : side.primary}
            </D>
          </View>
        );
      })}
    </View>
  );
}

/** This over's balls, oldest first ("1  4  Wd  W"). */
export function ThisOver({ marks }: { marks: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, flexWrap: 'wrap' }}>
      <T size={12} w={700} ls={0.08} color={colors.muted}>
        THIS OVER
      </T>
      {marks.map((mark, i) => (
        <View key={i} style={{ minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: mark.includes('W') && !mark.startsWith('Wd') ? colors.bad : colors.raised }}>
          <T size={12} w={800} color={mark.includes('W') && !mark.startsWith('Wd') ? colors.onPrimary : colors.fg}>
            {mark}
          </T>
        </View>
      ))}
    </View>
  );
}

/**
 * The scorer's keys: one tap on a number records a ball. Wide, no-ball and wicket arm the next
 * number, so a run-out on a no-ball is "No ball, Wicket, 1" and a stray tap costs no wicket.
 */
export function CricketPad({ actions, color, onBall }: { actions: ScoringAction[]; color: string; onBall: (event: PluginEvent) => void }) {
  const { colors } = useTheme();
  const [extra, setExtra] = useState<Extra>('none');
  const [wicket, setWicket] = useState(false);
  const runs = actions.filter((a) => a.id.startsWith('ball-'));
  const armed = extra !== 'none' || wicket;

  const press = (action: ScoringAction) => {
    onBall({ ...action.event, extra, wicket });
    setExtra('none');
    setWicket(false);
  };

  const toggle = (label: string, on: boolean, onPress: () => void) => (
    <Tap
      key={label}
      label={label}
      onPress={onPress}
      style={{ flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color : colors.surface, borderWidth: 1, borderColor: on ? color : colors.line2 }}
    >
      <T size={15} w={800} color={on ? colors.ink : colors.fg}>
        {label}
      </T>
    </Tap>
  );

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {runs.map((a) => (
          <Tap
            key={a.id}
            label={`${a.label} ${a.label === '1' ? 'run' : 'runs'}`}
            onPress={() => press(a)}
            style={{ flexBasis: '22%', flexGrow: 1, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: armed ? withAlpha(color, 0.28) : withAlpha(color, 0.14), borderWidth: 1, borderColor: withAlpha(color, 0.38) }}
          >
            <D size={34} lh={34}>
              {a.label}
            </D>
          </Tap>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {toggle('Wide', extra === 'wide', () => setExtra(extra === 'wide' ? 'none' : 'wide'))}
        {toggle('No ball', extra === 'no_ball', () => setExtra(extra === 'no_ball' ? 'none' : 'no_ball'))}
        {toggle('Wicket', wicket, () => setWicket(!wicket))}
      </View>
      <T size={13} color={colors.muted} center numberOfLines={1}>
        {armed ? 'Now tap the runs taken (0 if none)' : 'Tap the runs off this ball'}
      </T>
    </View>
  );
}

/** Undo's neighbours: end the innings early, and before the first ball, swap who bats. */
export function CricketActions({ actions, onAction }: { actions: ScoringAction[]; onAction: (action: ScoringAction) => void }) {
  return (
    <>
      {actions
        .filter((a) => !a.id.startsWith('ball-'))
        .map((a) => (
          <Button key={a.id} label={a.label} variant="surface" size={14} style={{ flex: 1 }} onPress={() => onAction(a)} />
        ))}
    </>
  );
}
