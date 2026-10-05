import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type DialogButton = {
  text?: string;
  style?: DialogButtonStyle;
  onPress?: () => void;
  disabled?: boolean;
  [key: string]: unknown;
};

export type DialogRequest = {
  title?: string;
  message?: string;
  buttons?: DialogButton[];
};

type DialogState = DialogRequest & { id: number };

type DialogHandler = (request: DialogRequest) => void;

let handler: DialogHandler | null = null;
let counter = 0;

function runFallback(request: DialogRequest) {
  if (Platform.OS !== 'web') {
    Alert.alert(request.title ?? '', request.message ?? '', request.buttons);
    return;
  }
  const text = [request.title, request.message].filter(Boolean).join('\n\n');
  const buttons = request.buttons ?? [];
  if (typeof window === 'undefined') return;
  const last = buttons.length ? buttons[buttons.length - 1] : undefined;
  if (!last) {
    if (text) window.alert(text);
    return;
  }
  const affirmative = buttons.findIndex(b => b.style !== 'cancel');
  const ok = affirmative === -1 ? true : window.confirm(`${text}\n\n${last.text ?? 'موافق'}`);
  if (ok) last.onPress?.();
}

export function showDialog(request: DialogRequest) {
  if (handler) handler(request);
  else runFallback(request);
}

export function installWebAlertPatch() {
  if (Platform.OS !== 'web') return;
  const target = Alert as unknown as Record<string, unknown>;
  if (target.__haynaPatched) return;
  target.__haynaPatched = true;
  target.alert = (title?: string, message?: string, buttons?: DialogButton[]) =>
    showDialog({ title, message, buttons });
}

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  useEffect(() => {
    installWebAlertPatch();
    handler = request => setState({ ...request, id: ++counter });
    return () => {
      handler = null;
    };
  }, []);

  const close = useCallback(() => setState(null), []);

  const onButtonPress = useCallback((button: DialogButton) => {
    const run = button.onPress;
    if (button.disabled) return;
    setState(null);
    if (typeof run === 'function') {
      setTimeout(() => run(), 0);
    }
  }, []);

  const buttons = state?.buttons?.length ? state.buttons : [{ text: 'حسناً' }];

  return (
    <>
      {children}
      <Modal
        visible={!!state}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="إغلاق" />
        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.card}>
            {!!state?.title && <Text style={styles.title}>{state.title}</Text>}
            {!!state?.message && <Text style={styles.message}>{state.message}</Text>}
            <View style={[styles.actions, buttons.length > 2 && styles.actionsColumn]}>
              {buttons.map((button, index) => {
                const variant = button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'muted' : 'primary';
                return (
                  <Pressable
                    key={`${index}-${button.text ?? ''}`}
                    onPress={() => onButtonPress(button)}
                    disabled={button.disabled}
                    style={[
                      styles.action,
                      variant === 'danger' && styles.actionDanger,
                      variant === 'muted' && styles.actionMuted,
                      button.disabled && styles.actionDisabled,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.actionText,
                        variant === 'danger' && styles.actionTextDanger,
                        variant === 'muted' && styles.actionTextMuted,
                      ]}
                    >
                      {button.text ?? 'موافق'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 44, 34, 0.55)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    gap: 10,
    shadowColor: '#022c22',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 12,
  },
  title: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 26,
  },
  message: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 23,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
  },
  actionsColumn: {
    flexDirection: 'column',
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  actionDanger: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  actionMuted: {
    backgroundColor: '#f1f5f9',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionTextDanger: {
    color: '#dc2626',
  },
  actionTextMuted: {
    color: '#475569',
  },
});
