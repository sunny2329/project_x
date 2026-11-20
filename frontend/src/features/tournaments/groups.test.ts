import { groupSub, rowStatus } from './groups';
import type { StandingRow } from './types';

const row = (rank: number, won: number, tiebreak: StandingRow['tiebreak'] = null, played = 3): StandingRow => ({ entryId: `e${rank}`, name: `P${rank}`, rank, tiebreak, played, won, lost: played - won, majorWon: 0, majorLost: 0, minorWon: 0, minorLost: 0 });
const fx = (...statuses: string[]) => statuses.map((status) => ({ status }) as never);

describe('groupSub', () => {
  it('reports a three-way tie, completion, matches left and not started', () => {
    const tied = [row(1, 2, 'major_diff'), row(2, 2, 'minor_diff'), row(3, 2, 'minor_diff'), row(4, 0)];
    expect(groupSub(tied, fx('completed', 'completed'))).toBe('3-way tie');
    expect(groupSub([row(1, 3), row(2, 2), row(3, 1), row(4, 0)], fx('completed', 'completed', 'bye'))).toBe('Complete');
    expect(groupSub([row(1, 1, null, 1), row(2, 0, null, 1)], fx('completed', 'ready', 'pending'))).toBe('2 left');
    expect(groupSub([row(1, 0, null, 0), row(2, 0, null, 0)], fx('ready', 'pending'))).toBe('Not started');
  });
});

describe('rowStatus', () => {
  const rows = [row(1, 2, 'major_diff'), row(2, 2, 'minor_diff'), row(3, 2, 'minor_diff'), row(4, 0)];
  it('marks qualifiers and the one out on a tiebreak once the group is done', () => {
    expect(rowStatus(rows[0]!, rows, 2, true)).toEqual({ text: 'Qualified', tone: 'good' });
    expect(rowStatus(rows[2]!, rows, 2, true)).toEqual({ text: 'Out on tiebreak', tone: 'bad' });
    expect(rowStatus(rows[3]!, rows, 2, true)).toBeNull();
    expect(rowStatus(rows[0]!, rows, 2, false)).toBeNull();
    expect(rowStatus(rows[0]!, rows, 0, true)).toBeNull();
    expect(rowStatus({ ...rows[0]!, withdrawn: true }, rows, 2, true)).toBeNull();
  });
});
