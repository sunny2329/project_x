import { Alert, Platform } from 'react-native';

/**
 * "Are you sure?" before a destructive action. React Native Web has no Alert dialog (Alert.alert
 * does nothing there), so the web app uses the browser's confirm instead.
 */
export function confirmAction(title: string, message: string | undefined, actionLabel: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.([title, message].filter(Boolean).join('\n\n'))) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
