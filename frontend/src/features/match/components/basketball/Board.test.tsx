import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';
import { createScorer, replay, scoringRegistry } from '@/engine/scoring';
import { configFromSetup, hoopsRules, PRESETS, roster } from '../../basketball';
import { useGameClock } from '../../store/clock.store';
import type { MatchView, PluginEvent, ScoreSummary } from '../../types';
import { BasketballBoard } from './Board';
import { FoulSheet, SubSheet, WhoScoredSheet } from './Sheets';

jest.mock('expo-router', () => ({ router: {}, useFocusEffect: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => undefined) }));

const NAMES = ['Pink City Ballers', 'Hawa Mahal Hoopers'];
const PEOPLE = [
  [
    ['Arjun Singh', 7],
    ['Kabir Mehta', 11],
    ['Rohan Das', 23],
    ['Manav Gupta', 3],
    ['Neel Joshi', 14],
    ['Karan Saini', 18],
  ],
  [
    ['Dev Patel', 4],
    ['Ishaan Rathore', 9],
    ['Yash Bhatia', 30],
    ['Vikram Choudhary', 8],
    ['Sid Agarwal', 21],
  ],
] as const;

function makeMatch(config: Record<string, unknown>, sizes: [number, number]): MatchView {
  return {
    id: `m-${Math.random()}`,
    status: 'live',
    sport: { id: 9, slug: 'basketball', name: 'Basketball', accentColor: '#3B82F6' },
    format: { code: `${sizes[0]}v${sizes[0]}`, name: `${sizes[0]}v${sizes[0]}` },
    ruleset: { id: 'r', name: '3v3 · first to 21', scoringModel: 'baskets' },
    rulesetConfig: config,
    sides: [0, 1].map((index) => ({
      index,
      name: NAMES[index],
      color: index === 0 ? '#3B82F6' : '#F2EDE7',
      players: PEOPLE[index]!.slice(0, sizes[index]).map(([displayName, jerseyNumber], i) => ({ playerId: `p${index}${i}`, displayName, jerseyNumber, isGuest: false, userId: null })),
    })),
    events: [],
  } as unknown as MatchView;
}

const summary = (match: MatchView, events: unknown[]) =>
  replay(
    createScorer(scoringRegistry, 'baskets', match.rulesetConfig, match.sides.map((s) => ({ index: s.index, playerCount: s.players.length }))),
    events,
  ).summary as ScoreSummary;

function fakeLive(eventCount = 0) {
  return { tap: jest.fn(), undo: jest.fn(), eventCount, syncing: false, busy: false, error: null, offline: false } as never as Parameters<typeof BasketballBoard>[0]['live'] & { tap: jest.Mock; undo: jest.Mock };
}

async function renderBoard(match: MatchView, events: unknown[], live = fakeLive(events.length), extra: Partial<Parameters<typeof BasketballBoard>[0]> = {}) {
  const root = createRoot();
  const props = { match, score: summary(match, events), live, haptics: false, onLeave: jest.fn(), onMatchMenu: jest.fn(), onFinish: jest.fn(), onBreak: jest.fn(), ...extra };
  await act(async () => root.render(<BasketballBoard {...props} />));
  const all = (label: string) => root.container.queryAll((n: TestInstance) => n.props.accessibilityLabel === label);
  const press = async (label: string) => {
    const node = all(label)[0];
    if (!node) throw new Error(`No "${label}" in the board`);
    await act(async () => node.props.onClick({ persist: () => undefined, nativeEvent: {} }));
  };
  const text = () => JSON.stringify(root.container.toJSON());
  const rerender = async (next: Partial<typeof props>) => {
    Object.assign(props, next);
    await act(async () => root.render(<BasketballBoard {...props} />));
  };
  return { root, all, press, text, props, rerender, unmount: () => act(async () => root.unmount()) };
}

const first = configFromSetup(PRESETS[3], true);
const five = configFromSetup(PRESETS[5], true);

afterEach(() => useGameClock.setState({ clocks: {} }));

describe('BasketballBoard · first-to (3v3)', () => {
  it('shows both teams, the target, the ball and +1/+2 (no +3 in 1-and-2 scoring)', async () => {
    const b = await renderBoard(makeMatch(first, [3, 3]), []);
    const t = b.text();
    for (const s of ['Pink City Ballers', 'Hawa Mahal Hoopers', 'TEAM FOULS ', '21 to win', 'BALL: BALLERS', '10:00', 'Tip off: start the clock']) expect(t).toContain(s);
    expect(b.all('2 points for Pink City Ballers')).toHaveLength(1);
    expect(b.all('3 points for Pink City Ballers')).toHaveLength(0);
    await b.unmount();
  });

  it('sends a basket, then asks who scored until a chip, Skip or the next play', async () => {
    const match = makeMatch(first, [3, 3]);
    const live = fakeLive(0);
    const b = await renderBoard(match, [], live);
    await b.press('2 points for Pink City Ballers');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'score', sideIndex: 0, points: 2 });
    // The hook reports the new event; the chips show for that team only.
    await b.rerender({ score: summary(match, [{ type: 'score', sideIndex: 0, points: 2 }]), live: { ...live, eventCount: 1 } as never });
    expect(b.text()).toContain('WHO SCORED +2?');
    expect(b.all('2 points for Pink City Ballers')).toHaveLength(0);
    expect(b.all('2 points for Hawa Mahal Hoopers')).toHaveLength(1);
    await b.press('Kabir Mehta');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'tag', playerIndex: 1 });
    expect(b.text()).not.toContain('WHO SCORED');
    await b.unmount();
  });

  it('drops the chips when anything else happens (undo, another tap)', async () => {
    const match = makeMatch(first, [3, 3]);
    const live = fakeLive(0);
    const b = await renderBoard(match, [], live);
    await b.press('1 point for Hawa Mahal Hoopers');
    await b.rerender({ score: summary(match, [{ type: 'score', sideIndex: 1, points: 1 }]), live: { ...live, eventCount: 1 } as never });
    expect(b.text()).toContain('WHO SCORED +1?');
    // An undo elsewhere changes the count: the chips no longer belong to the last play.
    await b.rerender({ score: summary(match, []), live: { ...live, eventCount: 0 } as never });
    expect(b.text()).not.toContain('WHO SCORED');
    await b.unmount();
  });

  it('with "team score only" a basket asks nobody, but a foul still asks who', async () => {
    const match = makeMatch(configFromSetup(PRESETS[3], false), [3, 3]);
    const live = fakeLive(0);
    const b = await renderBoard(match, [], live);
    await b.press('2 points for Pink City Ballers');
    await b.rerender({ score: summary(match, [{ type: 'score', sideIndex: 0, points: 2 }]), live: { ...live, eventCount: 1 } as never });
    expect(b.text()).not.toContain('WHO SCORED');
    await b.press('Foul by Hawa Mahal Hoopers');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'foul', sideIndex: 1, kind: 'personal' });
    await b.rerender({ score: summary(match, [{ type: 'score', sideIndex: 0, points: 2 }, { type: 'foul', sideIndex: 1 }]), live: { ...live, eventCount: 2 } as never });
    expect(b.text()).toContain('FOUL BY WHO?');
    expect(b.text()).toContain('BENCH / TEAM');
    await b.press('Bench or team foul');
    expect(b.text()).not.toContain('FOUL BY WHO?');
    await b.unmount();
  });

  it('stamps plays with the clock once it has run, and flips the ball', async () => {
    const match = makeMatch(first, [3, 3]);
    const live = fakeLive(0);
    useGameClock.setState({ clocks: { [match.id]: { period: 1, left: 372, shot: 12, runningSince: null } } });
    const b = await renderBoard(match, [], live);
    expect(b.text()).toContain('6:12');
    await b.press('1 point for Pink City Ballers');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'score', sideIndex: 0, points: 1, clock: 372 });
    await b.press('Ball: Pink City Ballers. Tap to flip.');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'possession', sideIndex: 1 });
    await b.unmount();
  });

  it('starts and pauses the clock from the clock button', async () => {
    const match = makeMatch(first, [3, 3]);
    const b = await renderBoard(match, []);
    await b.press('Start clock');
    expect(useGameClock.getState().clocks[match.id]?.runningSince).not.toBeNull();
    await b.rerender({});
    await b.press('Pause clock');
    expect(useGameClock.getState().clocks[match.id]?.runningSince).toBeNull();
    await b.unmount();
  });

  it('calls game point and the winner', async () => {
    const match = makeMatch(first, [3, 3]);
    const near = Array.from({ length: 10 }, () => ({ type: 'score', sideIndex: 0, points: 2 }));
    const b = await renderBoard(match, near);
    expect(b.text()).toContain('GAME POINT · BALLERS');
    await b.rerender({ score: summary(match, [...near, { type: 'score', sideIndex: 0, points: 1 }]) });
    expect(b.text()).toContain('BALLERS WIN');
    expect(b.all('2 points for Pink City Ballers')).toHaveLength(0);
    await b.press('Undo last play');
    expect(b.props.live.undo).toHaveBeenCalled();
    await b.unmount();
  });

  it('offers to call time when the clock runs out, and sudden death after a tie', async () => {
    const match = makeMatch(first, [3, 3]);
    const live = fakeLive(2);
    useGameClock.setState({ clocks: { [match.id]: { period: 1, left: 0, shot: 0, runningSince: null } } });
    const events = [
      { type: 'score', sideIndex: 0, points: 2 },
      { type: 'score', sideIndex: 1, points: 2 },
    ];
    const b = await renderBoard(match, events, live);
    await b.press('Time up · call the game');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'period_end', clock: 0 });
    await b.rerender({ score: summary(match, [...events, { type: 'period_end', clock: 0 }]) });
    expect(b.text()).toContain('TIME · TIED · NEXT BASKET WINS');
    await b.unmount();
  });
});

describe('BasketballBoard · timed (5v5)', () => {
  it('shows the period, +3, foul dots, timeouts and the arrow', async () => {
    const match = makeMatch(five, [6, 5]);
    const live = fakeLive(0);
    const b = await renderBoard(match, [], live);
    const t = b.text();
    for (const s of ['PERIOD', 'Q1', '10:00', 'TIMEOUTS ', '2 left', 'ARROW']) expect(t).toContain(s);
    expect(b.all('3 points for Hawa Mahal Hoopers')).toHaveLength(1);
    expect(b.all('Reset shot clock to 24')).toHaveLength(1);
    expect(b.all('Reset shot clock to 14')).toHaveLength(1);
    await b.press('Possession arrow: Pink City Ballers. Tap to flip.');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'possession', sideIndex: 1 });
    await b.unmount();
  });

  it('greys out a fouled-out player in the foul chips', async () => {
    const match = makeMatch(five, [6, 5]);
    const fouls = Array.from({ length: 5 }, () => [{ type: 'foul', sideIndex: 1, playerIndex: 0 }]).flat();
    const live = fakeLive(fouls.length);
    const b = await renderBoard(match, fouls, live);
    await b.press('Foul by Hawa Mahal Hoopers');
    await b.rerender({ score: summary(match, [...fouls, { type: 'foul', sideIndex: 1 }]), live: { ...live, eventCount: fouls.length + 1 } as never });
    const dev = b.all('Dev Patel, fouled out')[0]!;
    expect(dev.props.accessibilityState?.disabled ?? dev.props['aria-disabled']).toBe(true);
    expect(b.text()).toContain('BONUS');
    await b.unmount();
  });

  it('ends a period from the clock and shows the break; the last one goes to the final score', async () => {
    const match = makeMatch(five, [5, 5]);
    const live = fakeLive(1);
    const onBreak = jest.fn();
    useGameClock.setState({ clocks: { [match.id]: { period: 1, left: 0, shot: 0, runningSince: null } } });
    const b = await renderBoard(match, [{ type: 'score', sideIndex: 0, points: 2 }], live, { onBreak });
    await b.press('Q1 over · see break');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'period_end', clock: 0 });
    expect(onBreak).toHaveBeenCalledTimes(1);
    await b.unmount();

    const q4 = [{ type: 'score', sideIndex: 0, points: 2 }, { type: 'period_end' }, { type: 'period_end' }, { type: 'period_end' }];
    const onBreak2 = jest.fn();
    useGameClock.setState({ clocks: { [match.id]: { period: 4, left: 0, shot: 0, runningSince: null } } });
    const c = await renderBoard(match, q4, fakeLive(4), { onBreak: onBreak2 });
    await c.press('Q4 over · final score');
    expect(onBreak2).not.toHaveBeenCalled();
    await c.unmount();
  });

  it('⇄ SUB: pauses the clock, asks who comes off, then who comes on, and sends the sub', async () => {
    const match = makeMatch(five, [6, 5]);
    const live = fakeLive(1);
    useGameClock.setState({ clocks: { [match.id]: { period: 1, left: 500, shot: 20, runningSince: Date.now() } } });
    const b = await renderBoard(match, [{ type: 'score', sideIndex: 0, points: 2 }], live);
    // Team B has no bench: no SUB button for them.
    expect(b.all('Substitute a Hawa Mahal Hoopers player')).toHaveLength(0);
    await b.press('Substitute a Pink City Ballers player');
    expect(useGameClock.getState().clocks[match.id]!.runningSince).toBeNull();
    expect(b.text()).toContain('SUB · WHO’S COMING OFF?');
    expect(b.all('2 points for Pink City Ballers')).toHaveLength(0);
    expect(b.all('Take off Karan Saini')).toHaveLength(0);
    await b.press('Take off Arjun Singh');
    expect(b.text()).toContain('#7 OFF · WHO’S COMING ON?');
    expect(b.all('Put on Arjun Singh')).toHaveLength(0);
    await b.press('Put on Karan Saini');
    expect(live.tap).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'sub', sideIndex: 0, outIndex: 0, inIndex: 5 }));
    expect(b.text()).not.toContain('WHO’S COMING');
    await b.unmount();
  });

  it('⇄ SUB can be cancelled at either step, and is dropped by another play', async () => {
    const match = makeMatch(five, [6, 5]);
    const live = fakeLive(0);
    const b = await renderBoard(match, [], live);
    await b.press('Substitute a Pink City Ballers player');
    await b.press('Cancel the substitution');
    expect(b.text()).not.toContain('COMING OFF');
    await b.press('Substitute a Pink City Ballers player');
    await b.press('Take off Kabir Mehta');
    await b.press('Cancel the substitution');
    expect(b.all('2 points for Pink City Ballers')).toHaveLength(1);
    await b.press('Substitute a Pink City Ballers player');
    await b.rerender({ live: { ...live, eventCount: 1 } as never, score: summary(match, [{ type: 'score', sideIndex: 1, points: 2 }]) });
    expect(b.text()).not.toContain('COMING OFF');
    expect(live.tap).not.toHaveBeenCalled();
    await b.unmount();
  });

  it('a fifth foul asks who comes on (Later keeps them on); a fouled-out player can come off but not go back on', async () => {
    const match = makeMatch(five, [6, 5]);
    const four = Array.from({ length: 4 }, () => ({ type: 'foul', sideIndex: 0, playerIndex: 0 }));
    const live = fakeLive(4);
    const b = await renderBoard(match, four, live);
    await b.press('Foul by Pink City Ballers');
    const withFoul = [...four, { type: 'foul', sideIndex: 0 }];
    await b.rerender({ score: summary(match, withFoul), live: { ...live, eventCount: 5 } as never });
    await b.press('Arjun Singh');
    expect(live.tap).toHaveBeenLastCalledWith({ type: 'tag', playerIndex: 0 });
    const tagged = [...withFoul, { type: 'tag', playerIndex: 0 }];
    await b.rerender({ score: summary(match, tagged), live: { ...live, eventCount: 6 } as never });
    expect(b.text()).toContain('#7 FOULED OUT · WHO COMES ON?');
    await b.press('Sub later');
    expect(b.text()).not.toContain('FOULED OUT · WHO');
    // Later on: SUB lists Arjun as fouled out, and he is not offered to come back on.
    await b.press('Substitute a Pink City Ballers player');
    expect(b.text()).toContain('FOULED OUT');
    await b.press('Take off Arjun Singh');
    await b.press('Put on Karan Saini');
    expect(live.tap).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'sub', outIndex: 0, inIndex: 5 }));
    // Now the only one on the bench is Arjun, who fouled out: nobody can come on, so no SUB button.
    const subbed = [...tagged, { type: 'sub', sideIndex: 0, outIndex: 0, inIndex: 5 }];
    await b.rerender({ score: summary(match, subbed), live: { ...live, eventCount: 7 } as never });
    expect(b.all('Substitute a Pink City Ballers player')).toHaveLength(0);
    await b.unmount();
  });

  it('a foul-out from the foul sheet asks too, but not when nobody is left on the bench', async () => {
    const match = makeMatch(five, [6, 5]);
    const fourB = Array.from({ length: 4 }, () => ({ type: 'foul', sideIndex: 1, playerIndex: 0 }));
    const b = await renderBoard(match, fourB, fakeLive(4));
    await b.press('Foul by Hawa Mahal Hoopers');
    await b.rerender({ score: summary(match, [...fourB, { type: 'foul', sideIndex: 1 }]), live: { ...fakeLive(5) } as never });
    await b.press('Dev Patel');
    expect(b.text()).not.toContain('WHO COMES ON');
    await b.unmount();
  });

  it('finishes a decided game', async () => {
    const match = makeMatch(five, [5, 5]);
    const events = [{ type: 'score', sideIndex: 1, points: 3 }, { type: 'period_end' }, { type: 'period_end' }, { type: 'period_end' }, { type: 'period_end' }];
    const onFinish = jest.fn();
    const b = await renderBoard(match, events, fakeLive(events.length), { onFinish });
    expect(b.text()).toContain('Hoopers win');
    await b.press('Finish game');
    expect(onFinish).toHaveBeenCalled();
    await b.unmount();
  });
});

describe('sheets', () => {
  const match = makeMatch(five, [6, 5]);
  const rules = hoopsRules(five);
  const rosters = [roster(match, 0), roster(match, 1)] as [ReturnType<typeof roster>, ReturnType<typeof roster>];

  async function mount(el: React.ReactElement) {
    const root = createRoot();
    await act(async () => root.render(el));
    const find = (label: string) => root.container.queryAll((n: TestInstance) => n.props.accessibilityLabel === label)[0];
    const press = async (label: string) => {
      const node = find(label);
      if (!node) throw new Error(`No "${label}"`);
      await act(async () => node.props.onClick({ persist: () => undefined, nativeEvent: {} }));
    };
    const text = () => JSON.stringify(root.container.toJSON());
    return { find, press, text, unmount: () => act(async () => root.unmount()) };
  }

  it('foul sheet: team, player, kind, with the foul-out warning', async () => {
    const fouls = Array.from({ length: 4 }, () => ({ type: 'foul', sideIndex: 1, playerIndex: 0 }));
    const g = summary(match, fouls).game!;
    const onFoul = jest.fn();
    const s = await mount(
      <FoulSheet match={match} game={g} rules={rules} rosters={rosters} clockText="Clock paused at Q1 · 04:18" canEndPeriod endLabel="End quarter now" endNote="Ends Q1 at 04:18" complete={false} onClose={jest.fn()} onFoul={onFoul} onTimeout={jest.fn()} onSub={jest.fn()} onEndPeriod={jest.fn()} onMatchMenu={jest.fn()} />,
    );
    await s.press('Hoopers · 4 fouls');
    await s.press('Dev Patel, 4 fouls');
    expect(s.text()).toContain('#4 Dev has 4 fouls. This one fouls them out. It is also the team’s 5th foul this quarter');
    await s.press('Technical');
    expect(s.text()).toContain('Add foul · #4 Dev');
    expect(onFoul).not.toHaveBeenCalled();
    await s.press('Add foul · #4 Dev');
    expect(onFoul).toHaveBeenCalledWith(1, 0, 'technical');
    await s.unmount();
  });

  it('foul sheet: timeouts run out and the period can be ended', async () => {
    const g = summary(match, [{ type: 'timeout', sideIndex: 0 }, { type: 'timeout', sideIndex: 0 }]).game!;
    const onTimeout = jest.fn();
    const onEnd = jest.fn();
    const s = await mount(
      <FoulSheet match={match} game={g} rules={rules} rosters={rosters} clockText="" canEndPeriod endLabel="End quarter now" endNote="Ends Q1 at 10:00" complete={false} onClose={jest.fn()} onFoul={jest.fn()} onTimeout={onTimeout} onSub={jest.fn()} onEndPeriod={onEnd} onMatchMenu={jest.fn()} />,
    );
    const ballers = s.find('Timeout · Ballers. None left this half')!;
    expect(ballers.props.accessibilityState?.disabled ?? ballers.props['aria-disabled']).toBe(true);
    await s.press('Timeout · Hoopers. 2 left this half');
    expect(onTimeout).toHaveBeenCalledWith(1);
    await s.press('End quarter now. Ends Q1 at 10:00');
    expect(onEnd).toHaveBeenCalled();
    await s.unmount();
  });

  it('sub sheet: only bench players who have not fouled out can come on', async () => {
    const onSub = jest.fn();
    const g = summary(match, []).game!;
    const s = await mount(<SubSheet game={g} rosters={rosters} names={NAMES} onClose={jest.fn()} onSub={onSub} />);
    expect(s.text()).toContain('#18 Karan');
    await s.press('Arjun Singh');
    await s.press('Karan Saini');
    await s.press('#18 Karan on for #7 Arjun');
    expect(onSub).toHaveBeenCalledWith(0, 0, 5);
    await s.unmount();
    // Hoopers have no bench at all.
    const t = await mount(<SubSheet game={g} rosters={rosters} names={NAMES} onClose={jest.fn()} onSub={onSub} />);
    await t.press('Hoopers');
    expect(t.text()).toContain('Nobody on the bench');
    await t.unmount();
  });

  it('who scored: picks the scorer and assist, and an and-one', async () => {
    const g = summary(match, [{ type: 'score', sideIndex: 0, points: 2 }]).game!;
    const onSave = jest.fn();
    const s = await mount(<WhoScoredSheet play={g.plays[0]!} game={g} rosters={rosters} names={NAMES} onClose={jest.fn()} onSave={onSave} />);
    expect(s.text()).toContain('+2 · PINK CITY BALLERS');
    await s.press('Arjun Singh');
    await s.press('And-one: fouled on the shot, add a free throw');
    expect(onSave).toHaveBeenLastCalledWith(0, null, true);
    await s.press('#11 Kabir');
    await s.press('Save · #7 Arjun');
    expect(onSave).toHaveBeenLastCalledWith(0, 1, false);
    await s.unmount();
  });
});

it('fake events type-check as plugin events', () => {
  const e: PluginEvent = { type: 'score', sideIndex: 0, points: 2 };
  expect(e.type).toBe('score');
});
