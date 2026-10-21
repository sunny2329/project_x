import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScoringControls } from '../components/ScoringControls';
import { matchView, scoreSummary } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn() } }));

describe('ScoringControls', () => {
  it('sends the event of the action tapped under a side', async () => {
    const onEvent = jest.fn();
    await render(<ScoringControls match={matchView()} busy={false} onEvent={onEvent} />);
    await fireEvent.press(screen.getByLabelText('Point, Rohan'));
    expect(onEvent).toHaveBeenCalledWith({ type: 'rally_won', sideIndex: 1 });
  });

  it('draws whatever actions the plugin offers, with no sport-specific code', async () => {
    const onEvent = jest.fn();
    const score = scoreSummary({
      actions: [
        { id: 'rally-0', label: 'Point', sideIndex: 0, event: { type: 'rally_won', sideIndex: 0 } },
        { id: 'rally-1', label: 'Side out', sideIndex: 1, event: { type: 'rally_won', sideIndex: 1 } },
        { id: 'timeout', label: 'Timeout', sideIndex: null, event: { type: 'timeout' } },
      ],
    });
    await render(<ScoringControls match={matchView({ score })} busy={false} onEvent={onEvent} />);
    await fireEvent.press(screen.getByLabelText('Side out, Rohan'));
    await fireEvent.press(screen.getByLabelText('Timeout'));
    expect(onEvent.mock.calls).toEqual([[{ type: 'rally_won', sideIndex: 1 }], [{ type: 'timeout' }]]);
  });

  it('ignores taps while a request is running', async () => {
    const onEvent = jest.fn();
    await render(<ScoringControls match={matchView()} busy onEvent={onEvent} />);
    await fireEvent.press(screen.getByLabelText('Point, Aarav'));
    expect(onEvent).not.toHaveBeenCalled();
  });
});
