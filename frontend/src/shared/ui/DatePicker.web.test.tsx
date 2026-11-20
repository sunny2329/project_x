import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';
import { DatePicker } from './DatePicker.web';

async function render(props: Parameters<typeof DatePicker>[0]) {
  const root = createRoot();
  await act(async () => root.render(<DatePicker {...props} />));
  const input = root.container.queryAll((n: TestInstance) => n.type === 'input')[0]!;
  return { input, unmount: () => act(async () => root.unmount()) };
}

describe('DatePicker (web)', () => {
  it('shows the day, with the min / max limits, and reports a picked day keeping the time', async () => {
    const value = new Date(2026, 10, 9, 18, 30);
    const onChange = jest.fn();
    const p = await render({ value, mode: 'date', minimumDate: new Date(2026, 0, 1), maximumDate: new Date(2026, 10, 11), onChange });
    expect(p.input.props).toMatchObject({ type: 'date', value: '2026-11-09', min: '2026-01-01', max: '2026-11-11' });
    await act(async () => p.input.props.onChange({ target: { value: '2026-11-02' } }));
    const [event, picked] = onChange.mock.calls[0]!;
    expect(event).toEqual({ type: 'set' });
    expect([picked.getFullYear(), picked.getMonth(), picked.getDate(), picked.getHours(), picked.getMinutes()]).toEqual([2026, 10, 2, 18, 30]);
    await p.unmount();
  });

  it('time mode: 5-minute steps, keeps the day; a cleared field changes nothing', async () => {
    const value = new Date(2026, 10, 9, 9, 5);
    const onChange = jest.fn();
    const p = await render({ value, mode: 'time', minuteInterval: 5, onChange });
    expect(p.input.props).toMatchObject({ type: 'time', value: '09:05', step: 300 });
    await act(async () => p.input.props.onChange({ target: { value: '' } }));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => p.input.props.onChange({ target: { value: '14:45' } }));
    const picked: Date = onChange.mock.calls[0]![1];
    expect([picked.getDate(), picked.getHours(), picked.getMinutes(), picked.getSeconds()]).toEqual([9, 14, 45, 0]);
    await p.unmount();
  });
});
