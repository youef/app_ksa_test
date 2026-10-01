import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming, runOnJS, useSharedValue } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Info, CheckCircle2, AlertTriangle, X } from 'lucide-react-native';

type IslandType = 'success' | 'error' | 'info';

interface IslandState {
  visible: boolean;
  title: string;
  message?: string;
  type: IslandType;
}

interface DynamicIslandContextProps {
  showIsland: (title: string, message?: string, type?: IslandType) => void;
  hideIsland: () => void;
}

const DynamicIslandContext = createContext<DynamicIslandContextProps>({
  showIsland: () => {},
  hideIsland: () => {},
});

export const useDynamicIsland = () => useContext(DynamicIslandContext);

const { width } = Dimensions.get('window');
const ISLAND_WIDTH_COLLAPSED = 120;
const ISLAND_WIDTH_EXPANDED = width - 32;

export const DynamicIslandProvider = ({ children }: { children: ReactNode }) => {
  const [islandState, setIslandState] = useState<IslandState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const widthAnim = useSharedValue(ISLAND_WIDTH_COLLAPSED);
  const heightAnim = useSharedValue(36);
  const opacityAnim = useSharedValue(0);
  const translateYAnim = useSharedValue(-50);
  
  let timer: NodeJS.Timeout;

  const showIsland = (title: string, message?: string, type: IslandType = 'info') => {
    if (timer) clearTimeout(timer);
    
    setIslandState({ visible: true, title, message, type });
    
    // Animate in
    translateYAnim.value = withSpring(Platform.OS === 'ios' ? 12 : 32, { damping: 12 });
    opacityAnim.value = withTiming(1, { duration: 300 });
    
    if (message) {
      widthAnim.value = withSpring(ISLAND_WIDTH_EXPANDED, { damping: 14 });
      heightAnim.value = withSpring(80, { damping: 14 });
    } else {
      widthAnim.value = withSpring(200, { damping: 14 });
      heightAnim.value = withSpring(44, { damping: 14 });
    }

    timer = setTimeout(() => {
      hideIsland();
    }, 4000);
  };

  const hideIsland = () => {
    translateYAnim.value = withSpring(-50);
    opacityAnim.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(resetIsland)();
    });
  };

  const resetIsland = () => {
    setIslandState(prev => ({ ...prev, visible: false }));
    widthAnim.value = ISLAND_WIDTH_COLLAPSED;
    heightAnim.value = 36;
  };

  const animatedStyle = useAnimatedStyle(() => ({
    width: widthAnim.value,
    height: heightAnim.value,
    opacity: opacityAnim.value,
    transform: [{ translateY: translateYAnim.value }],
  }));

  const renderIcon = () => {
    switch (islandState.type) {
      case 'success': return <CheckCircle2 size={24} color="#34C759" />;
      case 'error': return <AlertTriangle size={24} color="#FF3B30" />;
      case 'info':
      default: return <Info size={24} color="#007AFF" />;
    }
  };

  return (
    <DynamicIslandContext.Provider value={{ showIsland, hideIsland }}>
      {children}
      {islandState.visible && (
        <Animated.View style={[styles.container, animatedStyle]}>
          <TouchableOpacity activeOpacity={0.9} onPress={hideIsland} style={styles.touchable}>
            <View style={styles.islandInner}>
              <View style={styles.iconContainer}>{renderIcon()}</View>
              <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={1}>{islandState.title}</Text>
                {!!islandState.message && (
                  <Text style={styles.message} numberOfLines={2}>{islandState.message}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </DynamicIslandContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    backgroundColor: '#000',
    borderRadius: 40,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  touchable: {
    flex: 1,
    padding: 12,
  },
  islandInner: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  iconContainer: {
    marginLeft: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  message: {
    color: '#rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
});
