import { act } from 'react';
import { StyleSheet } from 'react-native';
import { createRoot, type TestInstance } from 'test-renderer';
import { PRESETS } from '../basketball';
import { useMatchDraft } from '../store/draft.store';
import type { SportSummary } from '../types';
import { BasketballSetup } from './BasketballSetupScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false, replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const sport = { id: 9, slug: 'basketball', name: 'Basketball', formats: [], rulesets: [] } as unknown as SportSummary;

async function render() {
  const root = createRoot();
  await act(async () => root.render(<BasketballSetup sport={sport} forResult={false} />));
  const button = (label: string) => {
    const node = root.container.queryAll((n: TestInstance) => n.props.accessibilityLabel === label)[0];
    if (!node) throw new Error(`No "${label}"`);
    return node;
  };
  const flexOf = (label: string) => StyleSheet.flatten(button(label).props.style)?.flex;
  return { root, button, flexOf, unmount: () => act(async () => root.unmount()) };
}

beforeEach(() => {
  useMatchDraft.getState().reset();
});

describe('Basketball setup layout', () => {
  // Regression: buttons that grew (flex: 1) inside the setting rows' content-sized right side were
  // measured at zero width on Android, so the rules card showed up as a tall empty box.
  it('setting-row buttons size to their label; only the full-width bars share out their width', async () => {
    const s = await render();
    for (const label of ['1 · 2', '1 · 2 · 3']) expect(s.flexOf(label)).toBeUndefined();
    for (const label of ['3', '4', '5', 'Half', 'Full']) expect(s.flexOf(label)).toBe(1);
    await s.unmount();
  });

  it('the timed rows (4 quarters / 2 halves / 1 game) size to their label too', async () => {
    useMatchDraft.getState().setHoops({ setup: PRESETS[5] });
    const s = await render();
    for (const label of ['4 quarters', '2 halves', '1 game']) expect(s.flexOf(label)).toBeUndefined();
    await s.unmount();
  });
});
