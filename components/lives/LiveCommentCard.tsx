import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import type { LiveChatMessage, LiveChatRole } from '@/lib/lives';

export default function LiveCommentCard({ message, onLongPress }: { message: LiveChatMessage; onLongPress: () => void }) {
  const role: LiveChatRole = message.sender_role === 'host' || message.sender_role === 'guest' ? message.sender_role : 'viewer';
  const verified = Boolean(message.profiles?.is_verified) && role === 'viewer';
  const name = message.profiles?.display_name || message.profiles?.username || 'جارٍ';
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350} style={[styles.card, role === 'host' && styles.hostCard, role === 'guest' && styles.guestCard]}>
      <View style={styles.header}>
        {role === 'host' && <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>مضيف</Text></View>}
        {role === 'guest' && <View style={styles.guestBadge}><Text style={styles.guestBadgeText}>ضيف</Text></View>}
        {verified && <BadgeCheck size={12} color="#fbbf24" />}
        <Text style={styles.name}>{name}</Text>
      </View>
      <Text style={styles.body}>{message.body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: 'rgba(2,6,23,0.34)', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6, marginVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  hostCard: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(6,78,59,0.4)' },
  guestCard: { borderColor: 'rgba(56,189,248,0.38)', backgroundColor: 'rgba(12,74,110,0.38)' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 1 },
  name: { color: '#a7f3d0', fontWeight: '900', fontSize: 11 },
  body: { color: '#fff', fontSize: 12, textAlign: 'right', lineHeight: 18 },
  hostBadge: { backgroundColor: 'rgba(16,185,129,0.25)', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 },
  hostBadgeText: { color: '#6ee7b7', fontSize: 9, fontWeight: '900' },
  guestBadge: { backgroundColor: 'rgba(56,189,248,0.25)', borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 },
  guestBadgeText: { color: '#7dd3fc', fontSize: 9, fontWeight: '900' },
});
