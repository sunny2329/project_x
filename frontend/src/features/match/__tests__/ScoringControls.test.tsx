import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScoringControls } from '../components/ScoringControls';
import { matchDetail, scoreView } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() } }));

describe('ScoringControls', () => {
  it('scores a point for the tapped side', async () => {
    const onEvent = jest.fn();
    await render(<ScoringControls match={matchDetail()} busy={false} onEvent={onEvent} />);
    await fireEvent.press(screen.getByLabelText('point for Rohan'));
    expect(onEvent).toHaveBeenCalledWith({ type: 'point', side: 2 });
  });

  it('records goals and ends the half in football', async () => {
    const onEvent = jest.fn();
    const period = { no: 1, label: '1st half', score: [0, 0] as [number, number], winner: null, finished: false };
    const match = matchDetail({
      config: { kind: 'timed_goals', periods: 2, periodMinutes: 20 },
      score: scoreView({ kind: 'timed_goals', currentPeriod: period, periods: [period] }),
    });
    await render(<ScoringControls match={match} busy={false} onEvent={onEvent} />);
    await fireEvent.press(screen.getByLabelText('Goal for Aarav'));
    await fireEvent.press(screen.getByText('End 1st half'));
    expect(onEvent.mock.calls).toEqual([[{ type: 'goal', side: 1 }], [{ type: 'period_end' }]]);
  });

  it('applies the wide and wicket toggles to the next ball only', async () => {
    const onEvent = jest.fn();
    const match = matchDetail({
      config: { kind: 'overs', overs: 6, ballsPerOver: 6, wickets: 5, wideRuns: 1, noBallRuns: 1, battingFirst: 1 },
      score: scoreView({
        kind: 'overs',
        cricket: {
          battingSide: 1,
          innings: [{ battingSide: 1, runs: 0, wickets: 0, legalBalls: 0, overs: '0.0', extras: 0, finished: false }],
          target: null,
          thisOver: [],
        },
      }),
    });
    await render(<ScoringControls match={match} busy={false} onEvent={onEvent} />);
    await fireEvent.press(screen.getByText('Wide'));
    await fireEvent.press(screen.getByText('Wicket'));
    await fireEvent.press(screen.getByLabelText('1 run, wide, wicket'));
    await fireEvent.press(screen.getByLabelText('4 runs'));
    expect(onEvent.mock.calls).toEqual([
      [{ type: 'ball', runs: 1, extra: 'wide', wicket: true }],
      [{ type: 'ball', runs: 4, extra: 'none', wicket: false }],
    ]);
  });

  it('ignores taps while a request is running', async () => {
    const onEvent = jest.fn();
    await render(<ScoringControls match={matchDetail()} busy onEvent={onEvent} />);
    await fireEvent.press(screen.getByLabelText('point for Aarav'));
    expect(onEvent).not.toHaveBeenCalled();
  });
});
