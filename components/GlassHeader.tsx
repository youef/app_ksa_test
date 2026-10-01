import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

interface GlassHeaderProps {
  title: string;
  showBack?: boolean;
  rightComponent?: React.ReactNode;
}

export default function GlassHeader({ title, showBack = false, rightComponent }: GlassHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <BlurView intensity={Platform.OS === 'ios' ? 85 : 100} tint="light" style={styles.blurContainer}>
        <View style={styles.content}>
          {/* Left / Back Button */}
          <View style={styles.side}>
            {showBack && (
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <ChevronRight size={24} color="#059669" />
                <Text style={styles.backText}>رجوع</Text>
              </Pressable>
            )}
          </View>

          {/* Title */}
          <View style={styles.center}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>

          {/* Right Component */}
          <View style={styles.sideRight}>
            {rightComponent}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 100,
  },
  blurContainer: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Status bar padding
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  content: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  side: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sideRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  center: {
    flex: 2,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  backButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
    marginRight: -2,
  },
});
