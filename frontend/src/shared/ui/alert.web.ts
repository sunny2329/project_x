import type { AlertButton } from 'react-native';

/**
 * Browser version of `alert.ts`: React Native's Alert is a no-op on the web, so confirmations use
 * the browser's own dialogs. One choice besides Cancel → OK / Cancel. Several → asked one at a
 * time, first "OK" wins. No buttons → a plain notice.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;
  const choices = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancel = (buttons ?? []).find((b) => b.style === 'cancel');
  if (typeof window === 'undefined') return;
  if (!choices.length) {
    window.alert(text);
    cancel?.onPress?.();
    return;
  }
  if (choices.length === 1 && cancel) {
    if (window.confirm(text)) choices[0]!.onPress?.();
    else cancel.onPress?.();
    return;
  }
  if (choices.length === 1) {
    window.alert(text);
    choices[0]!.onPress?.();
    return;
  }
  for (const choice of choices) {
    if (window.confirm(`${text}\n\n${choice.text ?? 'OK'}?`)) {
      choice.onPress?.();
      return;
    }
  }
  cancel?.onPress?.();
}
