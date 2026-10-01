import React from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, QrCode } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

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
        colors={isVerified ? ['#052E16', '#065F46', '#10B981'] : ['#1E293B', '#334155', '#475569']}
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
            <Text style={styles.userName} numberOfLines={1}>{name || 'جار مجهول'}</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationText}>{district ? `حي ${district}` : 'غير محدد'}</Text>
              <Text style={styles.locationDot}>•</Text>
              <Text style={styles.locationText}>{city || 'غير محدد'}</Text>
            </View>
          </View>

          {/* Bottom Section */}
          <View style={styles.bottomRow}>
            <View style={styles.badgeContainer}>
              {isVerified ? (
                <>
                  <ShieldCheck size={20} color="#D1FAE5" />
                  <Text style={styles.badgeText}>ابن الحي المعتمد</Text>
                </>
              ) : (
                <Text style={styles.badgeTextUnverified}>غير موثق</Text>
              )}
            </View>
            
            <Pressable onPress={onPressQR} style={styles.qrButton}>
              <QrCode size={40} color="#fff" strokeWidth={1.5} />
            </Pressable>
          </View>
        </BlurView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: width - 32,
    alignSelf: 'center',
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
  },
  card: {
    borderRadius: 24,
    height: 200,
    overflow: 'hidden',
  },
  glassOverlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  emblemContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  emblem: {
    fontSize: 24,
  },
  brandContainer: {
    alignItems: 'flex-start',
  },
  brandTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
  detailsContainer: {
    marginTop: 10,
  },
  userName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  locationText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
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
  },
  badgeText: {
    color: '#D1FAE5',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  badgeTextUnverified: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 13,
  },
  qrButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
