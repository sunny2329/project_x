import { newClientEventId, parseScores, playedSegments, resultText, sportIcon, statusLabel } from '../format';
import { addPlayer, fitToFormat, fromOption, lineupProblem, newGuest, removePlayer, type Lineup } from '../lineup';
import { matchView, scoreSummary } from './fixtures';

describe('format', () => {
  it('uses the icon key the sport carries', () => {
    expect(sportIcon({ iconKey: 'tennis' })).toBe('tennis');
    expect(sportIcon(null)).toBe('trophy-outline');
  });

  it('describes a decided match, including walkovers and retirements', () => {
    const won = matchView({ status: 'completed', resultType: 'played', score: scoreSummary({ complete: true, winnerSideIndex: 1 }) });
    expect(resultText(won)).toBe('Rohan won');
    expect(resultText({ ...won, resultType: 'no_show' })).toBe('Rohan won (no-show)');
    expect(resultText({ ...won, resultType: 'retired' })).toBe('Rohan won (retired)');
    expect(resultText({ ...won, resultType: 'double_walkover', score: { ...won.score, winnerSideIndex: null } })).toBe('Double walkover');
    expect(statusLabel('walkover')).toBe('W/O');
  });

  it('keeps only segments that have started', () => {
    const segments = [...scoreSummary().segments, { type: 'game', sequence: 3, label: 'Game 3', scores: [0, 0], display: ['0', '0'], winnerSideIndex: null, complete: false, children: [] }];
    expect(playedSegments(segments).map((s) => s.sequence)).toEqual([1, 2]);
  });

  it('parses typed-in scores', () => {
    expect(parseScores('21-15, 18-21 21–19')).toEqual([
      [21, 15],
      [18, 21],
      [21, 19],
    ]);
    expect(parseScores('6-4; 7:6')).toEqual([
      [6, 4],
      [7, 6],
    ]);
    expect(parseScores('21')).toBeNull();
    expect(parseScores('')).toBeNull();
  });

  it('makes v4-shaped client event ids', () => {
    expect(newClientEventId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newClientEventId()).not.toBe(newClientEventId());
  });
});

describe('lineup', () => {
  const me = fromOption({ playerId: 'p1', userId: 'u1', username: 'me', displayName: 'Me', isGuest: false });
  const a = fromOption({ playerId: null, userId: 'u2', username: 'a', displayName: 'A', isGuest: false });
  const guest = newGuest('Dev', '+919812345678');
  const doubles = { minPerSide: 2, maxPerSide: 2 };
  const singles = { minPerSide: 1, maxPerSide: 1 };

  it('turns search results and guests into participant inputs', () => {
    expect(me.input).toEqual({ playerId: 'p1' });
    expect(a.input).toEqual({ userId: 'u2' });
    expect(guest).toMatchObject({ isGuest: true, userId: null, input: { guest: { displayName: 'Dev', phone: '+919812345678' } } });
  });

  it('adds each player once and respects the side size', () => {
    let lineup: Lineup = [[me], []];
    lineup = addPlayer(lineup, 1, a, 1);
    expect(addPlayer(lineup, 0, a, 2)).toBe(lineup);
    expect(addPlayer(lineup, 1, guest, 1)).toBe(lineup);
    expect(removePlayer(lineup, a.key)).toEqual([[me], []]);
  });

  it('says what is missing and trims when the format shrinks', () => {
    const lineup: Lineup = [[me, a], [guest]];
    expect(lineupProblem(lineup, doubles)).toBe('Add 1 more player to the other side');
    expect(lineupProblem([[me], []], singles)).toBe('Add 1 more player to the other side');
    expect(fitToFormat(lineup, singles)).toEqual([[me], [guest]]);
    expect(lineupProblem(fitToFormat(lineup, singles), singles)).toBeNull();
  });
});
