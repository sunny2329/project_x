import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { MatchCard, MatchDetail, MatchOptions, ScoreView, ScoringConfig, Side } from './types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const SPORT_ICONS: Record<string, IconName> = {
  PICKLEBALL: 'racquetball',
  BADMINTON: 'badminton',
  TABLE_TENNIS: 'table-tennis',
  VOLLEYBALL: 'volleyball',
  FOOTBALL: 'soccer',
  BOX_CRICKET: 'cricket',
};

export function sportIcon(code: string): IconName {
  return SPORT_ICONS[code] ?? 'trophy-outline';
}

/** Each sport's accent (tile stripe and icon), as on the Discover design. */
const SPORT_COLORS: Record<string, string> = {
  BOX_CRICKET: '#22C55E',
  FOOTBALL: '#3B82F6',
  BADMINTON: '#A855F7',
  PICKLEBALL: '#F97316',
  TABLE_TENNIS: '#EAB308',
  VOLLEYBALL: '#14B8A6',
};

export function sportColor(code: string): string {
  return SPORT_COLORS[code] ?? '#FF6B00';
}

/** One line describing the rules: "Best of 3 · games to 11", "2 × 20 min", "6 overs · 5 wickets". */
export function rulesSummary(config: ScoringConfig): string {
  switch (config.kind) {
    case 'rally': {
      const unit = config.periodName === 'Set' ? 'sets' : 'games';
      const deciding = config.decidingPoints ? ` (decider to ${config.decidingPoints})` : '';
      const cap = config.cap ? `, cap ${config.cap}` : '';
      const length = config.bestOf === 1 ? `1 ${unit.slice(0, -1)}` : `Best of ${config.bestOf}`;
      return `${length} · ${unit} to ${config.pointsToWin}${cap}${deciding}`;
    }
    case 'timed_goals':
      return `${config.periods} × ${config.periodMinutes} min`;
    case 'overs':
      return `${config.overs} over${config.overs === 1 ? '' : 's'} · ${config.wickets} wicket${config.wickets === 1 ? '' : 's'}`;
  }
}

/** The options a sport offers, with the values to pick from. */
export function optionChoices(config: ScoringConfig): { key: keyof MatchOptions; label: string; values: number[] }[] {
  switch (config.kind) {
    case 'rally':
      return [
        { key: 'bestOf', label: config.periodName === 'Set' ? 'Sets' : 'Games', values: [1, 3, 5] },
        { key: 'pointsToWin', label: 'Points to win', values: [...new Set([11, 15, 21, 25, config.pointsToWin])].sort((a, b) => a - b) },
      ];
    case 'timed_goals':
      return [{ key: 'periodMinutes', label: 'Minutes per half', values: [10, 15, 20, 25, 30, 45] }];
    case 'overs':
      return [
        { key: 'overs', label: 'Overs', values: [2, 3, 4, 5, 6, 8, 10] },
        { key: 'wickets', label: 'Wickets', values: [2, 3, 4, 5, 6, 8, 10] },
      ];
  }
}

/** The default value of each option, taken from the sport's rules. */
export function defaultOptions(config: ScoringConfig): MatchOptions {
  switch (config.kind) {
    case 'rally':
      return { bestOf: config.bestOf as 1 | 3 | 5, pointsToWin: config.pointsToWin };
    case 'timed_goals':
      return { periodMinutes: config.periodMinutes };
    case 'overs':
      return { overs: config.overs, wickets: config.wickets, battingFirst: config.battingFirst };
  }
}

/** "12:05" from milliseconds (minutes can exceed 59). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function sideName(match: Pick<MatchCard, 'sides'>, side: Side): string {
  return match.sides.find((s) => s.no === side)?.name ?? `Side ${side}`;
}

/** "Aarav won", "Draw", "Tied", or null while the match is undecided. */
export function resultText(match: Pick<MatchDetail, 'sides' | 'score'>): string | null {
  if (!match.score.finished) return null;
  if (match.score.winner === null) return match.score.kind === 'overs' ? 'Tied' : 'Draw';
  return `${sideName(match, match.score.winner)} won`;
}

/** What the cricket chase needs: "Needs 12 from 9 balls". */
export function chaseText(match: Pick<MatchDetail, 'score' | 'config'>): string | null {
  const cricket = match.score.cricket;
  if (!cricket || cricket.target === null || match.score.finished || match.config.kind !== 'overs') return null;
  const innings = cricket.innings.at(-1)!;
  const runs = cricket.target - innings.runs;
  const balls = match.config.overs * match.config.ballsPerOver - innings.legalBalls;
  return `Needs ${runs} from ${balls} ball${balls === 1 ? '' : 's'}`;
}

/**
 * The score shown for one side. Rally sports: the current game's points (the games won once
 * the match is over) with games won underneath. Football: goals. Cricket: runs/wickets and overs.
 */
export function sideScore(score: ScoreView, side: Side): { main: string; sub: string | null } {
  const i = side - 1;
  if (score.kind === 'rally') {
    const unit = score.currentPeriod.label.startsWith('Set') ? 'Sets' : 'Games';
    return score.finished
      ? { main: String(score.headline[i]), sub: unit }
      : { main: String(score.currentPeriod.score[i]), sub: `${unit} ${score.headline[i]}` };
  }
  if (score.kind === 'timed_goals') return { main: String(score.headline[i]), sub: null };
  const innings = score.cricket?.innings.find((inn) => inn.battingSide === side);
  if (!innings) return { main: '–', sub: 'Yet to bat' };
  return { main: `${innings.runs}/${innings.wickets}`, sub: `${innings.overs} ov` };
}
