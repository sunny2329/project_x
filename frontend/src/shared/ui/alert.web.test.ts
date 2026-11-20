import { showAlert } from './alert.web';

describe('showAlert (web)', () => {
  // React Native's test environment has no browser dialogs: stand-ins on window.
  const win = window as unknown as { confirm: jest.Mock; alert: jest.Mock };
  let confirm: jest.Mock;
  let alert: jest.Mock;
  beforeEach(() => {
    confirm = win.confirm = jest.fn();
    alert = win.alert = jest.fn();
  });

  it('Cancel + one action: OK runs the action, Cancel runs cancel', () => {
    const go = jest.fn();
    const back = jest.fn();
    confirm.mockReturnValueOnce(true);
    showAlert('End Q1 now?', 'Undo brings it back.', [{ text: 'Keep playing', style: 'cancel', onPress: back }, { text: 'End Q1', style: 'destructive', onPress: go }]);
    expect(confirm).toHaveBeenCalledWith('End Q1 now?\n\nUndo brings it back.');
    expect(go).toHaveBeenCalledTimes(1);
    confirm.mockReturnValueOnce(false);
    showAlert('End Q1 now?', undefined, [{ text: 'Keep playing', style: 'cancel', onPress: back }, { text: 'End Q1', onPress: go }]);
    expect(go).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('several actions are offered one at a time; the first OK wins, all declined = cancel', () => {
    const a = jest.fn();
    const b = jest.fn();
    const cancel = jest.fn();
    confirm.mockReturnValueOnce(false).mockReturnValueOnce(true);
    showAlert('Match', undefined, [{ text: 'End early', onPress: a }, { text: 'Abandon', onPress: b }, { text: 'Cancel', style: 'cancel', onPress: cancel }]);
    expect(confirm).toHaveBeenNthCalledWith(2, 'Match\n\nAbandon?');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    confirm.mockReturnValue(false);
    showAlert('Match', undefined, [{ text: 'End early', onPress: a }, { text: 'Abandon', onPress: b }, { text: 'Cancel', style: 'cancel', onPress: cancel }]);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('no buttons, or a single OK, is a plain notice', () => {
    const ok = jest.fn();
    showAlert('Saved');
    showAlert('Saved', 'All done', [{ text: 'OK', onPress: ok }]);
    expect(alert).toHaveBeenNthCalledWith(1, 'Saved');
    expect(alert).toHaveBeenNthCalledWith(2, 'Saved\n\nAll done');
    expect(ok).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});
