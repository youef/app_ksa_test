import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { C } from '@/lib/ui';

type Props = {
  label?: string;
  error?: string;
};

export default function ScreenState({ label = 'جارٍ التحميل...', error }: Props) {
  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    padding: 24,
  },
  label: {
    marginTop: 12,
    color: C.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: C.danger,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
