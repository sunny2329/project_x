import { chaseText, defaultOptions, formatClock, resultText, rulesSummary, sideScore } from '../format';
import { addPlayer, fitToFormat, lineupProblem, removePlayer, type Lineup } from '../lineup';
import type { OversConfig } from '../types';
import { matchDetail, scoreView } from './fixtures';

const cricket: OversConfig = { kind: 'overs', overs: 6, ballsPerOver: 6, wickets: 5, wideRuns: 1, noBallRuns: 1, battingFirst: 1 };

describe('rulesSummary', () => {
  it('describes each kind of scoring', () => {
    expect(rulesSummary({ kind: 'rally', periodName: 'Game', pointsToWin: 21, winBy: 2, cap: 30, bestOf: 3, decidingPoints: null })).toBe(
      'Best of 3 · games to 21, cap 30',
    );
    expect(rulesSummary({ kind: 'rally', periodName: 'Set', pointsToWin: 25, winBy: 2, cap: null, bestOf: 1, decidingPoints: 15 })).toBe(
      '1 set · sets to 25 (decider to 15)',
    );
    expect(rulesSummary({ kind: 'timed_goals', periods: 2, periodMinutes: 20 })).toBe('2 × 20 min');
    expect(rulesSummary(cricket)).toBe('6 overs · 5 wickets');
  });

  it('takes default options from the rules', () => {
    expect(defaultOptions(cricket)).toEqual({ overs: 6, wickets: 5, battingFirst: 1 });
  });
});

describe('scores', () => {
  it('shows the current game while live and games won when finished', () => {
    const period = { no: 2, label: 'Game 2', score: [7, 5] as [number, number], winner: null, finished: false };
    expect(sideScore(scoreView({ currentPeriod: period, headline: [1, 0] }), 1)).toEqual({ main: '7', sub: 'Games 1' });
    expect(sideScore(scoreView({ finished: true, winner: 1, headline: [2, 0] }), 1)).toEqual({ main: '2', sub: 'Games' });
  });

  it('shows runs/wickets, or yet to bat, in cricket', () => {
    const score = scoreView({
      kind: 'overs',
      cricket: {
        battingSide: 1,
        innings: [{ battingSide: 1, runs: 34, wickets: 2, legalBalls: 22, overs: '3.4', extras: 1, finished: false }],
        target: null,
        thisOver: ['1', '4'],
      },
    });
    expect(sideScore(score, 1)).toEqual({ main: '34/2', sub: '3.4 ov' });
    expect(sideScore(score, 2)).toEqual({ main: '–', sub: 'Yet to bat' });
  });

  it('describes the chase and the result', () => {
    const chasing = matchDetail({
      config: cricket,
      score: scoreView({
        kind: 'overs',
        cricket: {
          battingSide: 2,
          innings: [
            { battingSide: 1, runs: 40, wickets: 5, legalBalls: 30, overs: '5.0', extras: 0, finished: true },
            { battingSide: 2, runs: 30, wickets: 1, legalBalls: 27, overs: '4.3', extras: 0, finished: false },
          ],
          target: 41,
          thisOver: [],
        },
      }),
    });
    expect(chaseText(chasing)).toBe('Needs 11 from 9 balls');
    expect(resultText(matchDetail())).toBeNull();
    expect(resultText(matchDetail({ score: scoreView({ finished: true, winner: 2 }) }))).toBe('Rohan won');
    expect(resultText(matchDetail({ score: scoreView({ kind: 'overs', finished: true, winner: null }) }))).toBe('Tied');
  });

  it('formats the match clock', () => {
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(61 * 60_000)).toBe('61:00');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('lineup', () => {
  const me = { id: 'u1', username: 'me', fullName: 'Me' };
  const a = { id: 'u2', username: 'a', fullName: 'A' };
  const b = { id: 'u3', username: 'b', fullName: 'B' };
  const doubles = { id: 'f', name: 'Doubles', minPlayers: 2, maxPlayers: 2 };
  const singles = { id: 'f', name: 'Singles', minPlayers: 1, maxPlayers: 1 };

  it('adds each player once and respects the side size', () => {
    let lineup: Lineup = [[me], []];
    lineup = addPlayer(lineup, 2, a, 1);
    expect(addPlayer(lineup, 1, a, 2)).toBe(lineup);
    expect(addPlayer(lineup, 2, b, 1)).toBe(lineup);
    expect(removePlayer(lineup, 'u2')).toEqual([[me], []]);
  });

  it('says what is missing and trims when the format shrinks', () => {
    const lineup: Lineup = [[me, a], [b]];
    expect(lineupProblem(lineup, doubles)).toBe('Add 1 more player to the other side');
    expect(lineupProblem([[me], []], singles)).toBe('Add 1 more player to the other side');
    expect(fitToFormat(lineup, singles)).toEqual([[me], [b]]);
    expect(lineupProblem(fitToFormat(lineup, singles), singles)).toBeNull();
  });
});
