import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ImageOff, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ImagePreviewModal({ uri, title, onClose }: { uri: string | null; title: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [uri]);

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" accessibilityLabel="إغلاق الصورة" onPress={onClose} style={styles.close}>
            <X size={23} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
        </View>
        <View style={styles.content}>
          {failed ? (
            <View style={styles.center}>
              <ImageOff size={36} color="#BCD1C8" />
              <Text style={styles.hint}>تعذر تحميل الصورة</Text>
            </View>
          ) : uri && (
            <Image key={uri} accessibilityLabel={title} source={{ uri }} resizeMode="contain" style={styles.image}
              onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />
          )}
          {loading && !failed && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.center]}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#101C18' },
  bar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#273B33', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'right' },
  content: { flex: 1, padding: 12 },
  image: { flex: 1, width: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { color: '#BCD1C8', fontSize: 14 },
});
