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
                <ChevronRight size={28} color="#007AFF" />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  backButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
    marginRight: -4,
  },
});
