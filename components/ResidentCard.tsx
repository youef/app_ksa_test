import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, QrCode } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

interface ResidentCardProps {
  name: string;
  district: string;
  city: string;
  isVerified: boolean;
  onPressQR: () => void;
}

export default function ResidentCard({ name, district, city, isVerified, onPressQR }: ResidentCardProps) {
  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={isVerified ? ['#052E16', OASIS.colors.deep, OASIS.colors.primary] : [OASIS.colors.ink, OASIS.colors.ink, OASIS.colors.muted]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <BlurView intensity={30} tint="light" style={styles.glassOverlay}>
          {/* Top Section */}
          <View style={styles.headerRow}>
            <View style={styles.emblemContainer}>
              <Text style={styles.emblem}>🇸🇦</Text>
            </View>
            <View style={styles.brandContainer}>
              <Text style={styles.brandTitle}>بطاقة ساكن الحي</Text>
              <Text style={styles.brandSubtitle}>Resident Pass</Text>
            </View>
          </View>

          {/* User Details */}
          <View style={styles.detailsContainer}>
            <Text style={styles.userName} numberOfLines={2} ellipsizeMode="tail" adjustsFontSizeToFit={false}>{name || 'جار مجهول'}</Text>
            <View style={styles.locationRow}>
              <Text numberOfLines={1} style={styles.locationText}>{district ? `حي ${district}` : 'غير محدد'}</Text>
              <Text style={styles.locationDot}>•</Text>
              <Text numberOfLines={1} style={styles.locationText}>{city || 'غير محدد'}</Text>
            </View>
          </View>

          {/* Bottom Section */}
          <View style={styles.bottomRow}>
            <View style={styles.badgeContainer}>
              {isVerified ? (
                <>
                  <ShieldCheck size={20} color={OASIS.colors.soft} />
                  <Text style={styles.badgeText}>ابن الحي المعتمد</Text>
                </>
              ) : (
                <Text style={styles.badgeTextUnverified}>غير موثق</Text>
              )}
            </View>

            <Pressable oasisKind="icon" onPress={onPressQR} accessibilityRole="button" accessibilityLabel="عرض رمز QR لبطاقة ساكن الحي" style={styles.qrButton}>
              <QrCode size={40} color={OASIS.colors.surface} strokeWidth={1.5} />
            </Pressable>
          </View>
        </BlurView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    maxWidth: 540,
    minWidth: 0,
    alignSelf: 'center',
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0,
    shadowRadius: 16,
    elevation: 15,
  },
  card: {
    borderRadius: 14,
    minHeight: 216,
    overflow: 'hidden',
  },
  glassOverlay: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  emblemContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  emblem: {
    fontSize: 20,
  },
  brandContainer: {
    alignItems: 'flex-start',
    flexShrink: 1,
    minWidth: 0,
  },
  brandTitle: {
    color: OASIS.colors.surface,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
  },
  detailsContainer: {
    marginTop: 10,
  },
  userName: {
    color: OASIS.colors.surface,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'right',
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minWidth: 0,
  },
  locationText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  locationDot: {
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  badgeContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexShrink: 1,
  },
  badgeText: {
    color: OASIS.colors.soft,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  badgeTextUnverified: {
    color: OASIS.colors.line,
    fontWeight: '600',
    fontSize: 13,
  },
  qrButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 56,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
