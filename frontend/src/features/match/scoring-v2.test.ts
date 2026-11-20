import { banner, ralliesPlayed, serverLine, sidePill, tapHint } from './scoring-v2';
import type { MatchView, ScoreSummary, ScoringAction, SegmentSummary } from './types';

const side = (index: number, over: Partial<ScoreSummary['sides'][number]> = {}) => ({ index, primary: '0', current: '0', serving: false, serverNumber: null, serverPlayerIndex: null, serveNote: null, ...over });
const seg = (type: string, scores: number[], children: SegmentSummary[] = []): SegmentSummary => ({ type, sequence: 1, label: '', scores, display: scores.map(String), winnerSideIndex: null, complete: false, children });
function score(model: string, over: Partial<ScoreSummary> = {}): ScoreSummary {
  return { scoringModel: model, complete: false, winnerSideIndex: null, sides: [side(0), side(1)], segments: [seg('game', [0, 0])], headline: '', callout: null, totals: { major: [0, 0], minor: [0, 0], majorLabel: 'Games', minorLabel: 'Points' }, actions: [], ...over } as ScoreSummary;
}
const p = (n: string) => ({ playerId: n, userId: null, displayName: n, isGuest: false });
const doubles = { rulesetConfig: {}, sides: [{ index: 0, players: [p('Aarav Mehta'), p('Kabir Shah')] }, { index: 1, players: [p('Ishaan Rao'), p('Tara Kapoor')] }] } as unknown as MatchView;
const singles = { rulesetConfig: {}, sides: [{ index: 0, players: [p('Aarav Mehta')] }, { index: 1, players: [p('Rohan Iyer')] }] } as unknown as MatchView;

describe('sidePill', () => {
  it('badminton: serve and court, nothing on the receiver', () => {
    const s = score('rally', { sides: [side(0, { serving: true, serveNote: 'right court' }), side(1)] });
    expect(sidePill(singles, s, 0)).toEqual({ text: 'SERVE · RIGHT', tone: 'filled' });
    expect(sidePill(singles, s, 1)).toBeNull();
  });
  it('table tennis: which of the two serves', () => {
    const tt = { ...singles, rulesetConfig: { serve: { rotation: 'alternate', pointsPerServe: 2, everyPointFrom: 10 } } } as MatchView;
    const s = score('rally', { sides: [side(0, { serving: true }), side(1)], segments: [seg('game', [3, 2])] });
    expect(sidePill(tt, s, 0)).toEqual({ text: 'SERVE · 2 OF 2', tone: 'filled' });
  });
  it('pickleball: server number, receivers outlined', () => {
    const s = score('side_out', { sides: [side(0, { serving: true, serverNumber: 2 }), side(1)] });
    expect(sidePill(doubles, s, 0)).toEqual({ text: 'SERVING · 2', tone: 'filled' });
    expect(sidePill(doubles, s, 1)).toEqual({ text: 'RECEIVING', tone: 'outline' });
  });
  it('tennis: plain words; nothing once the match is over', () => {
    const s = score('tennis', { sides: [side(0), side(1, { serving: true })] });
    expect(sidePill(singles, s, 0)).toEqual({ text: 'Receiving', tone: 'plain' });
    expect(sidePill(singles, s, 1)).toEqual({ text: 'Serving', tone: 'plain' });
    expect(sidePill(singles, { ...s, complete: true }, 1)).toBeNull();
  });
});

describe('serverLine', () => {
  it('names the server, number and court', () => {
    expect(serverLine(doubles, score('side_out', { sides: [side(0, { serving: true, serverNumber: 2, serverPlayerIndex: 0, serveNote: 'left court' }), side(1)] }))).toBe('Server 2 · Aarav · left court');
    expect(serverLine(singles, score('side_out', { sides: [side(0), side(1, { serving: true, serveNote: 'right court' })] }))).toBe('Rohan · right court');
    expect(serverLine(singles, score('side_out'))).toBeNull();
  });
});

describe('tapHint', () => {
  const action = (label: string) => ({ id: 'a', label, sideIndex: 0, event: { type: 'rally_won' } }) as ScoringAction;
  it('says what a tap does', () => {
    expect(tapHint(score('side_out'), action('Side out'), null)).toBe('Rally won → side out');
    expect(tapHint(score('side_out'), action('Point'), null)).toBe('Rally won → point');
    expect(tapHint(score('rally'), action('Point'), null)).toBe('Tap to add a point');
    expect(tapHint(score('rally'), action('Point'), 'Wins the game')).toBe('Wins the game');
    expect(tapHint(score('tennis'), action('Point'), null)).toBe('Tap when they win the point');
    expect(tapHint(score('rally'), undefined, null)).toBeNull();
    expect(tapHint(score('rally', { complete: true }), action('Point'), null)).toBeNull();
  });
});

describe('banner', () => {
  const names = ['Siddharth Rao', 'Karan Malhotra'];
  it('shows callouts and the tiebreak rule', () => {
    expect(banner(score('rally', { callout: 'Match point' }), names, {})).toBe('Match point');
    expect(banner(score('side_out', { callout: '7-4-2' }), names, {})).toBeNull();
    expect(banner(score('rally', { sides: [side(0, { current: '20' }), side(1, { current: '20' })] }), names, {})).toBe('20-all');
    expect(banner(score('rally', { sides: [side(0, { current: '9' }), side(1, { current: '9' })] }), names, {})).toBeNull();
    const tb = score('tennis', { callout: 'Tiebreak', segments: [seg('set', [6, 6], [seg('tiebreak', [5, 4])])] });
    expect(banner(tb, names, { tiebreakPoints: 7 })).toBe('Tiebreak · first to 7, win by 2');
    expect(banner({ ...tb, callout: 'Set point' }, names, {})).toBe('Set point · tiebreak');
    expect(banner(score('tennis', { callout: 'Match tiebreak', segments: [seg('match_tiebreak', [3, 2])] }), names, { matchTiebreakPoints: 10 })).toBe('Match tiebreak · first to 10, win by 2');
  });
  it('names who has the advantage', () => {
    const s = score('tennis', { callout: 'Advantage', segments: [seg('set', [2, 2], [seg('game', [3, 4])])] });
    expect(banner(s, names, {})).toBe('Advantage Karan');
    expect(banner({ ...s, complete: true }, names, {})).toBeNull();
  });
});

it('ralliesPlayed counts only rallies', () => {
  expect(ralliesPlayed([{ type: 'rally_won', sideIndex: 0 }, { type: 'timeout' }, { type: 'rally_won', sideIndex: 1 }])).toBe(2);
});
