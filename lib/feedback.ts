import { Alert, Platform } from 'react-native';

/**
 * Cross-platform user feedback.
 *
 * React Native's `Alert` is a no-op on react-native-web, so confirm/alert
 * dialogs silently did nothing on the web build (audit P-H3). These helpers
 * fall back to the browser's window.alert/confirm on web and use Alert on
 * native, so feedback works everywhere.
 */

export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export function confirmAction(opts: ConfirmOptions): void {
  const {
    title,
    message,
    confirmText = 'OK',
    cancelText = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
  } = opts;

  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(message ? `${title}\n\n${message}` : title);
    if (ok) onConfirm();
    else onCancel?.();
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ]);
  }
}
