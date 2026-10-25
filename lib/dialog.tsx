import { CircleCheck, CircleAlert, Info, TriangleAlert } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, View } from 'react-native';

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
  const tone = /خطأ|تعذر|فشل/.test(state?.title || '') ? 'error' : buttons.some(button => button.style === 'destructive') ? 'warning' : /نجاح|تم |نُشر/.test(state?.title || '') ? 'success' : 'info';
  const ToneIcon = tone === 'error' ? CircleAlert : tone === 'warning' ? TriangleAlert : tone === 'success' ? CircleCheck : Info;
  const toneColor = tone === 'error' ? OASIS.colors.danger : tone === 'warning' ? OASIS.colors.warning : tone === 'success' ? OASIS.colors.primary : OASIS.colors.info;

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
          <OasisSurface oasisSurface="sheet" oasisAsset={`alerts/${tone}-dialog`} accessibilityRole="alert" accessibilityViewIsModal style={styles.card}><View style={{ alignItems: 'center', marginBottom: 4 }}><ToneIcon size={32} color={toneColor} /></View>
            {!!state?.title && <Text style={styles.title}>{state.title}</Text>}
            {!!state?.message && <Text style={styles.message}>{state.message}</Text>}
            <View style={[styles.actions, buttons.length > 2 && styles.actionsColumn]}>
              {buttons.map((button, index) => {
                const variant = button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'muted' : 'primary';
                return (
                  <Pressable oasisKind="action" oasisVariant={variant === "muted" ? "secondary" : variant}
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
          </OasisSurface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowColor: OASIS.colors.deep,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0,
    shadowRadius: 26,
    elevation: 12,
  },
  title: {
    color: OASIS.colors.ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 26,
  },
  message: {
    color: OASIS.colors.muted,
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
    backgroundColor: OASIS.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  actionDanger: {
    backgroundColor: OASIS.colors.dangerSoft,
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
    color: OASIS.colors.surface,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionTextDanger: {
    color: OASIS.colors.danger,
  },
  actionTextMuted: {
    color: OASIS.colors.muted,
  },
});
