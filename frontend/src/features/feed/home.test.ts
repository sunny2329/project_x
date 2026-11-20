import type { MatchHistoryItem } from '@/features/profile/types';
import type { FixtureView } from '@/features/tournaments/types';
import { greeting, nextFixtureFor, resultLine, resultTitle, roundShort, tournamentLine } from './home';

const at = (h: number, d = 20) => new Date(2026, 10, d, h, 30);

describe('greeting', () => {
  it('follows the time of day', () => {
    expect([4, 5, 11, 12, 16, 17, 23].map((h) => greeting(at(h)))).toEqual([
      'Good evening', 'Good morning', 'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening', 'Good evening',
    ]);
  });
});

function fixture(over: Partial<FixtureView>): FixtureView {
  return {
    id: 'f', eventId: 'e1', event: { id: 'e1', name: "Men's Singles", sport: { slug: 'badminton', name: 'Badminton', accentColor: '#A855F7' } },
    stageId: 's', stageName: 'Knockout', stageType: 'knockout', groupId: null, groupName: null, round: 1, position: 1,
    roundName: 'Quarter-final', status: 'ready', entries: [], placeholders: [], winnerEntryId: null, court: null,
    scheduledAt: null, match: null, nextFixtureId: null, next: null, ...over,
  };
}

describe('roundShort', () => {
  it('shortens round and group names', () => {
    expect(roundShort({ roundName: 'Quarter-final', groupName: null })).toBe('QF');
    expect(roundShort({ roundName: 'Round of 16', groupName: null })).toBe('R16');
    expect(roundShort({ roundName: 'Final', groupName: null })).toBe('the final');
    expect(roundShort({ roundName: 'Round 2', groupName: 'Group B' })).toBe('Group B');
    expect(roundShort({ roundName: null, groupName: null })).toBe('a match');
  });
});

describe('nextFixtureFor', () => {
  const t = { events: [{ id: 'e1', name: 'MS', sport: { slug: 'badminton', accentColor: '#A855F7' } }] };
  it('picks my earliest open fixture in this tournament only', () => {
    const later = fixture({ id: 'later', scheduledAt: at(20).toISOString() });
    const soon = fixture({ id: 'soon', scheduledAt: at(19).toISOString() });
    const other = fixture({ id: 'other', eventId: 'e9', scheduledAt: at(8).toISOString() });
    const done = fixture({ id: 'done', status: 'completed', scheduledAt: at(7).toISOString() });
    const unscheduled = fixture({ id: 'tbd' });
    expect(nextFixtureFor(t, [later, unscheduled, other, done, soon])!.id).toBe('soon');
    expect(nextFixtureFor(t, [done, other])).toBeNull();
  });
});

describe('tournamentLine', () => {
  const single = { sports: [{ slug: 'badminton', name: 'Badminton', iconKey: 'badminton', accentColor: '#A855F7' }], events: [{ id: 'e1', name: 'MS', sport: { slug: 'badminton', accentColor: '' } }], live: null };
  const now = at(12);
  it('says when I play next', () => {
    expect(tournamentLine(single, fixture({ scheduledAt: at(19).toISOString() }), now)).toBe('Badminton · 1 category · You play QF at 7:30 PM');
    expect(tournamentLine(single, fixture({ scheduledAt: at(10, 22).toISOString() }), now)).toBe('Badminton · 1 category · You play QF 22 Nov 10:30 AM');
    expect(tournamentLine(single, fixture({}), now)).toBe('Badminton · 1 category · You play QF next');
    expect(tournamentLine(single, fixture({ status: 'live' }), now)).toBe("Badminton · 1 category · You're playing QF now");
  });
  it('summarises a multi-sport event and live tournaments I am not playing in', () => {
    const multi = {
      sports: ['badminton', 'tennis', 'padel', 'pickleball'].map((slug) => ({ slug, name: slug, iconKey: slug, accentColor: '' })),
      events: Array.from({ length: 9 }, (_, i) => ({ id: `e${i}`, name: 'x', sport: { slug: 'tennis', accentColor: '' } })),
      live: null,
    };
    expect(tournamentLine(multi, null, now)).toBe('Multi-sport · 4 sports · 9 categories');
    expect(tournamentLine({ ...single, live: { rounds: ['QF'], courtsInUse: 2 } }, null, now)).toBe('Badminton · 1 category · Live now');
  });
});

describe('result rows', () => {
  const m = {
    matchId: 'm', context: 'friendly', sport: { id: '3', slug: 'pickleball', name: 'Pickleball', iconKey: 'pickleball', accentColor: '' },
    playedAt: at(18, 19).toISOString(), outcome: 'won', resultType: 'played', status: 'completed', verification: 'not_required', awaiting: null,
    format: 'Singles', otherPlayers: ['Kabir Shah'], partners: [], opponents: ['Kabir Shah'], tournament: null, headline: '11-7, 11-9', ratingChange: 18,
  } as MatchHistoryItem;
  it('reads like the design', () => {
    expect(resultTitle(m)).toBe('Won vs Kabir S. · Pickleball');
    expect(resultLine(m, at(12))).toBe('11–7, 11–9 · Friendly · Yesterday');
  });
  it('handles doubles, one-word names, tournaments and losses', () => {
    const d = { ...m, outcome: 'lost', opponents: ['Ishaan', 'Tara Kapoor'], context: 'tournament', tournament: { name: 'Jaipur Smash Open', eventName: 'MD', roundName: 'QF' } } as MatchHistoryItem;
    expect(resultTitle(d)).toBe('Lost vs Ishaan & Tara K. · Pickleball');
    expect(resultLine(d, at(12))).toBe('11–7, 11–9 · Jaipur Smash Open · Yesterday');
  });
});
