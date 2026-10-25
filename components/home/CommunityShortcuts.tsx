import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

type Announcement = { id: string; title: string; message: string; expires_at: string };

export default function CommunityShortcuts({ signedIn: _signedIn }: { signedIn: boolean }) {
  const { colors } = useTheme();
  const [items, setItems] = useState<Announcement[]>([]);
  const [active, setActive] = useState(0);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('home_announcements')
      .select('id,title,message,expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(30);
    if (!error) setItems((data || []) as Announcement[]);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
      setActive(i => i + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const visible = items.filter(item => new Date(item.expires_at).getTime() > Date.now());
  const announcement = visible.length ? visible[active % visible.length] : null;
  if (!announcement) return null;

  return (
    <View style={[s.container, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={s.heading}>
        <Megaphone size={19} color={colors.primary} />
        <Text style={[s.headingText, { color: colors.primary }]}>إعلانات حيّنا</Text>
        <Text style={[s.counter, { color: colors.muted }]}>{visible.length > 1 ? `${(active % visible.length) + 1} / ${visible.length}` : 'إعلان عام'}</Text>
      </View>
      <Text style={[s.title, { color: colors.ink }]}>{announcement.title}</Text>
      <Text style={[s.message, { color: colors.muted }]}>{announcement.message}</Text>
      <Text style={[s.footer, { color: colors.muted }]}>يختفي الإعلان تلقائيًا خلال 24 ساعة من نشره{visible.length > 1 ? ' · يتغير كل 30 ثانية' : ''}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  container: { marginHorizontal: 14, marginTop: 8, marginBottom: 12, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8, minHeight: 110 },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  headingText: { fontSize: 13, fontWeight: '800', textAlign: 'right' },
  counter: { marginLeft: 'auto', fontSize: 11 },
  title: { fontSize: 16, fontWeight: '800', textAlign: 'right' },
  message: { fontSize: 13, lineHeight: 21, textAlign: 'right' },
  footer: { fontSize: 10, textAlign: 'right', marginTop: 3 },
});
