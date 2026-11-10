import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';
import { changeRule } from '../rules';
import { RulesSheet } from './RulesSheet';

jest.mock('expo-router', () => ({ router: {}, useFocusEffect: jest.fn(), useLocalSearchParams: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const ruleset = { name: '6 overs · 5 wickets', scoringModel: 'overs', config: { overs: 6, wickets: 5 } };

async function renderSheet(override: Record<string, number>, onChange = jest.fn()) {
  const root = createRoot();
  await act(async () => {
    root.render(<RulesSheet visible onClose={jest.fn()} ruleset={ruleset} override={override} onChange={onChange} onReset={jest.fn()} note="For this match only." />);
  });
  const find = (label: string) => root.container.queryAll((n: TestInstance) => n.props.accessibilityLabel === label)[0];
  const press = async (label: string) => {
    // Only host views are visible here: a Pressable's press arrives as its View's onClick.
    await act(async () => find(label)!.props.onClick({ persist: () => undefined, nativeEvent: {} }));
  };
  return { root, find, press, onChange };
}

describe('RulesSheet', () => {
  it('shows every cricket rule with its current value', async () => {
    const { root } = await renderSheet({ playersPerSide: 6 });
    const text = JSON.stringify(root.container.toJSON());
    for (const label of ['Players a side', 'Overs', 'Wickets', 'Balls an over', 'Runs for a wide', 'Runs for a no-ball', 'Super over: overs', 'Super over: wickets', 'For this match only.']) expect(text).toContain(label);
  });

  it('steps a rule up or down by one', async () => {
    const { press, onChange } = await renderSheet({});
    await press('More overs');
    expect(onChange).toHaveBeenLastCalledWith('overs', 7);
    await press('Fewer players a side');
    expect(onChange).toHaveBeenLastCalledWith('playersPerSide', 10);
    // The pulled-down wickets come from changeRule, which the screens call with this.
    expect(changeRule('overs', ruleset.config, {}, 'playersPerSide', 4)).toMatchObject({ wickets: 4 });
  });

  it('stops wickets at the players a side', async () => {
    const { find } = await renderSheet({ playersPerSide: 5, wickets: 5 });
    expect(find('More wickets')!.props['aria-disabled'] ?? find('More wickets')!.props.accessibilityState?.disabled).toBe(true);
    expect(find('Fewer wickets')!.props['aria-disabled'] ?? find('Fewer wickets')!.props.accessibilityState?.disabled).toBeFalsy();
  });
});
