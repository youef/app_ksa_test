import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { ShieldCheck, Award, Sparkles, CheckCircle, MapPin, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';

export interface NeighborBadgesCardProps {
  userId: string;
  isVerifiedNeighbor: boolean;
  city?: string;
  district?: string;
  reputationPoints: number;
  badges?: string[];
  onVerifiedSuccess?: () => void;
}

export const NeighborBadgesCard: React.FC<NeighborBadgesCardProps> = ({
  userId,
  isVerifiedNeighbor,
  city,
  district,
  reputationPoints,
  badges = ['جار جديد 👋', 'صاحب الفزعات 🤝'],
  onVerifiedSuccess,
}) => {
  const [verifying, setVerifying] = useState(false);

  const handleVerifyLocation = async () => {
    if (!userId) return;
    setVerifying(true);
    try {
      const loc = await getCurrentDeviceLocation();
      if (!loc) {
        Alert.alert('تعذر تحديد الموقع', 'اسمح للتطبيق بالوصول للموقع لإثبات سكنك بالحي.');
        return;
      }

      const place = await reverseGeocodeDeviceLocation(loc);
      const matchedDistrict = place?.district || district || 'حي معتمد';
      const matchedCity = place?.city || city || 'الرياض';

      // Update profile with verification
      const { error } = await supabase
        .from('profiles')
        .update({
          is_verified_neighbor: true,
          verification_method: 'gps_home',
          district: matchedDistrict,
          city: matchedCity,
        })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert(
        'تم توثيق سكنك بنجاح! 🛡️',
        `أنت الآن "جار موثق" في ${matchedDistrict}، وستظهر الشارة الخضراء في جميع فزعاتك وردودك.`
      );
      onVerifiedSuccess?.();
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إتمام التوثيق');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* 1. Verified Neighbor Status Banner */}
      {isVerifiedNeighbor ? (
        <LinearGradient
          colors={['#ecfdf5', '#d1fae5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.verifiedBanner}
        >
          <View style={styles.verifiedLeftCol}>
            <View style={styles.checkCircleWrap}>
              <CheckCircle size={14} color="#059669" />
            </View>
            <View>
              <Text style={styles.verifiedTitle}>جار موثق بالحي 🛡️</Text>
              <Text style={styles.verifiedSub}>
                سكن معتمد في {district ? `حي ${district}` : 'الحي'}
              </Text>
            </View>
          </View>
          <View style={styles.verifiedBadgePill}>
            <Text style={styles.verifiedBadgeText}>معتمد ✓</Text>
          </View>
        </LinearGradient>
      ) : (
        <Pressable
          style={styles.unverifiedBanner}
          onPress={handleVerifyLocation}
          disabled={verifying}
        >
          <View style={styles.unverifiedLeftCol}>
            <View style={styles.shieldIconWrap}>
              {verifying ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <ShieldCheck size={20} color="#059669" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.unverifiedTitle}>احصل على شارة "جار موثق" 🛡️</Text>
              <Text style={styles.unverifiedSub}>
                وثّق سكنك بالحي لزيادة مصداقية حسابك ومشاركاتك
              </Text>
            </View>
          </View>
          <ChevronLeft size={16} color="#059669" />
        </Pressable>
      )}

      {/* 2. Reputation & Badges Row */}
      <View style={styles.karmaRow}>
        <View style={styles.karmaBox}>
          <Award size={18} color="#d97706" />
          <Text style={styles.karmaNum}>{reputationPoints}</Text>
          <Text style={styles.karmaLabel}>نقاط السمعة بالحي ⭐</Text>
        </View>

        <View style={styles.badgesCol}>
          <Text style={styles.badgesHeading}>أوسمة الجار:</Text>
          <View style={styles.badgesWrap}>
            {badges.map((badge, idx) => (
              <View key={idx} style={styles.badgeChip}>
                <Text style={styles.badgeChipText}>{badge}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginTop: -22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 10,
  },
  verifiedBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 14,
  },
  verifiedLeftCol: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  checkCircleWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  verifiedTitle: { fontSize: 13.5, fontWeight: '900', color: '#065f46', textAlign: 'right' },
  verifiedSub: { fontSize: 11, color: '#047857', fontWeight: '600', marginTop: 1, textAlign: 'right' },
  verifiedBadgePill: { backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  verifiedBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },

  unverifiedBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    marginBottom: 14,
  },
  unverifiedLeftCol: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 },
  shieldIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  unverifiedTitle: { fontSize: 13, fontWeight: '900', color: '#065f46', textAlign: 'right' },
  unverifiedSub: { fontSize: 11, color: '#047857', fontWeight: '600', marginTop: 2, textAlign: 'right' },

  karmaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  karmaBox: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 110,
  },
  karmaNum: { fontSize: 18, fontWeight: '900', color: '#92400e', marginTop: 2 },
  karmaLabel: { fontSize: 10.5, fontWeight: '700', color: '#b45309', marginTop: 2 },

  badgesCol: { flex: 1, alignItems: 'flex-end' },
  badgesHeading: { fontSize: 11.5, fontWeight: '800', color: '#475569', marginBottom: 6 },
  badgesWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  badgeChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeChipText: { fontSize: 11, fontWeight: '800', color: '#334155' },
});
