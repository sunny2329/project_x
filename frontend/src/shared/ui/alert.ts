import { Alert, type AlertButton } from 'react-native';

/** The native dialog. `alert.web.ts` is the browser version (React Native's Alert does nothing there). */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  Alert.alert(title, message, buttons);
}
