import { View } from 'react-native';
import { createScorer, manualResultEvents, ScoringError, scoringRegistry } from '@/engine/scoring';
import { useTheme } from '@/shared/theme';
import { Notice, NumberBox, Row, T } from '@/shared/ui';
import type { RulesetOption } from '../types';

type Config = Record<string, unknown>;

/** How many rows to offer: best of 3 -> 3 games / sets. */
export function rowsFor(ruleset: Pick<RulesetOption, 'config'>): number {
  const n = Number(ruleset.config.bestOf ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** A plain-words reason a game score can't be final, or null if it could be (rally and side-out). */
export function gameProblem(model: string, config: Config, a: number, b: number, deciding: boolean): string | null {
  if (model === 'tennis') return null;
  const to = Number((deciding && config.decidingGamePoints) || config.pointsToWin || 21);
  const winBy = Number(config.winBy ?? 2);
  const cap = config.cap ? Number(config.cap) : null;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === lo) return `${a}-${b} is a tie. Someone has to win the game.`;
  if (cap && hi > cap) return `Games stop at ${cap}. ${hi} isn’t possible.`;
  if (cap && hi === cap) return lo < cap ? null : `${a}-${b} isn’t possible.`;
  if (hi < to) return `${hi}-${lo} doesn’t finish a game. The first to ${to} wins it.`;
  if (hi - lo < winBy) return `${a}-${b} can’t end a game. You need a ${winBy}-point lead, like ${lo + winBy}-${lo}${cap ? `, up to ${cap}` : ''}.`;
  if (hi > to && hi - lo > winBy) return `${a}-${b} isn’t possible. Past ${to}, a game ends as soon as someone leads by ${winBy}.`;
  return null;
}

export interface ResultCheck {
  /** Scores typed so far, up to the first empty row. */
  filled: number[][];
  /** The typed scores finish a match under these rules. */
  complete: boolean;
  invalidRow: number | null;
  message: string | null;
}

/** Friendly per-game messages first, then the engine's check of the whole match (the same one the server runs). */
export function checkResult(ruleset: Pick<RulesetOption, 'scoringModel' | 'config'>, cells: string[][], playersPerSide: number[]): ResultCheck {
  const rows = rowsFor(ruleset);
  const filled: number[][] = [];
  for (const [a, b] of cells.slice(0, rows)) {
    if (!a || !b) break;
    filled.push([Number(a), Number(b)]);
  }
  for (const [i, [a, b]] of filled.entries()) {
    const m = gameProblem(ruleset.scoringModel, ruleset.config, a!, b!, i === rows - 1 && rows > 1);
    if (m) return { filled, complete: false, invalidRow: i, message: m };
  }
  if (!filled.length) return { filled, complete: false, invalidRow: null, message: null };
  try {
    const scorer = createScorer(scoringRegistry, ruleset.scoringModel, ruleset.config, playersPerSide.map((n, index) => ({ index, playerCount: Math.max(1, n) })));
    manualResultEvents(scorer, filled);
    return { filled, complete: true, invalidRow: null, message: null };
  } catch (e) {
    const text = e instanceof ScoringError ? e.message : null;
    // "doesn't finish the match" only matters once every row is typed in.
    if (text && !(text.includes('does not finish') && filled.length < rows)) return { filled, complete: false, invalidRow: filled.length - 1, message: text };
    return { filled, complete: false, invalidRow: null, message: null };
  }
}

/** Rows of score boxes ("Game 1  [21] [15]") with the check's message under them. */
export function ResultGrid({
  ruleset,
  names,
  cells,
  onChange,
  check,
}: {
  ruleset: Pick<RulesetOption, 'scoringModel' | 'config'>;
  names: [string, string];
  cells: string[][];
  onChange: (cells: string[][]) => void;
  check: ResultCheck;
}) {
  const { colors } = useTheme();
  const rows = rowsFor(ruleset);
  const unit = ruleset.scoringModel === 'tennis' ? 'Set' : 'Game';
  const grid = Array.from({ length: rows }, (_, i) => cells[i] ?? ['', '']);
  const set = (row: number, col: number, v: string) => {
    const next = grid.map((r) => [...r]);
    next[row]![col] = v;
    onChange(next);
  };
  return (
    <View style={{ gap: 8 }}>
      <Row gap={8}>
        <View style={{ width: 60 }} />
        {names.map((n, i) => (
          <T key={i} size={14} w={700} center flex numberOfLines={1}>
            {n}
          </T>
        ))}
      </Row>
      {grid.map((row, i) => (
        <Row key={i} gap={8}>
          <T size={13} w={600} color={colors.muted} style={{ width: 60 }}>
            {unit} {i + 1}
          </T>
          {[0, 1].map((col) => (
            <NumberBox key={col} value={row[col]!} onChange={(v) => set(i, col, v)} label={`${unit} ${i + 1}, ${names[col]} ${unit === 'Set' ? 'games' : 'points'}`} invalid={check.invalidRow === i} />
          ))}
        </Row>
      ))}
      {check.message ? <Notice tone="error" icon="alert" text={check.message} /> : null}
    </View>
  );
}
