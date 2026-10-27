import { ScrollView, View } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import AdminBackgrounds from '@/components/admin/AdminBackgrounds';

export default function AdminBackgroundsScreen() {
  return <View style={{ flex: 1, backgroundColor: 'transparent' }}>
    <AppHeader title="إدارة صور الخلفيات" fallbackRoute="/admin" />
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled"><AdminBackgrounds /></ScrollView>
  </View>;
}
