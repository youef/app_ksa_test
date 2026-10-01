import { Alert, Platform, type AlertButton } from 'react-native';

// react-native-web ships Alert.alert as a no-op, which hid every save
// confirmation and error on the web build. Route it to the browser dialogs.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    const actions = buttons.filter((b) => b !== cancel);
    const confirmed = window.confirm(text);
    (confirmed ? actions[actions.length - 1] : cancel)?.onPress?.();
  };
}
