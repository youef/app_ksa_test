
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';

import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  LoaderCircle,
} from 'lucide-react-native';

type IslandType =
  | 'success'
  | 'error'
  | 'info'
  | 'warning'
  | 'loading';

interface IslandOptions {
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
}

interface IslandState {
  visible: boolean;
  title: string;
  message?: string;
  type: IslandType;
  actionLabel?: string;
  onAction?: () => void;
  dismissible: boolean;
}

interface DynamicIslandContextProps {
  showIsland: (
    title: string,
    message?: string,
    type?: IslandType,
    options?: IslandOptions,
  ) => void;
  hideIsland: () => void;
}

const DEFAULT_STATE: IslandState = {
  visible: false,
  title: '',
  message: undefined,
  type: 'info',
  dismissible: true,
};

const DynamicIslandContext =
  createContext<DynamicIslandContextProps | undefined>(
    undefined,
  );

export function useDynamicIsland() {
  const context = useContext(DynamicIslandContext);

  if (!context) {
    throw new Error(
      'useDynamicIsland must be used inside DynamicIslandProvider',
    );
  }

  return context;
}

const COLORS: Record<IslandType, string> = {
  success: '#34C759',
  error: '#FF453A',
  info: '#0A84FF',
  warning: '#FF9F0A',
  loading: '#64D2FF',
};

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 180,
  mass: 0.8,
};

interface ProviderProps {
  children: ReactNode;
}

export function DynamicIslandProvider({
  children,
}: ProviderProps) {
  const { width: screenWidth } = useWindowDimensions();

  const [island, setIsland] =
    useState<IslandState>(DEFAULT_STATE);

  const timerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  // Identifies the newest notification/animation.
  const versionRef = useRef(0);
  const mountedRef = useRef(true);

  const widthAnim = useSharedValue(120);
  const heightAnim = useSharedValue(42);
  const opacityAnim = useSharedValue(0);
  const translateYAnim = useSharedValue(-90);
  const scaleAnim = useSharedValue(0.88);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetHidden = useCallback((version: number) => {
    // Ignore completion callbacks from old animations.
    if (
      !mountedRef.current ||
      version !== versionRef.current
    ) {
      return;
    }

    setIsland(DEFAULT_STATE);

    widthAnim.value = 120;
    heightAnim.value = 42;
    scaleAnim.value = 0.88;
  }, [widthAnim, heightAnim, scaleAnim]);

  const hideIsland = useCallback(() => {
    if (!mountedRef.current) return;

    clearTimer();

    const version = ++versionRef.current;

    cancelAnimation(widthAnim);
    cancelAnimation(heightAnim);
    cancelAnimation(opacityAnim);
    cancelAnimation(translateYAnim);
    cancelAnimation(scaleAnim);

    translateYAnim.value = withSpring(-90, SPRING_CONFIG);

    opacityAnim.value = withTiming(
      0,
      { duration: 180 },
      (finished) => {
        if (finished) {
          runOnJS(resetHidden)(version);
        }
      },
    );

    scaleAnim.value = withTiming(0.88, {
      duration: 180,
    });
  }, [
    clearTimer,
    resetHidden,
    widthAnim,
    heightAnim,
    opacityAnim,
    translateYAnim,
    scaleAnim,
  ]);

  const showIsland = useCallback((
    title: string,
    message?: string,
    type: IslandType = 'info',
    options: IslandOptions = {},
  ) => {
    if (!mountedRef.current) return;

    clearTimer();

    const version = ++versionRef.current;

    cancelAnimation(widthAnim);
    cancelAnimation(heightAnim);
    cancelAnimation(opacityAnim);
    cancelAnimation(translateYAnim);
    cancelAnimation(scaleAnim);

    setIsland({
      visible: true,
      title,
      message,
      type,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      dismissible: options.dismissible ?? true,
    });

    const maxWidth = Math.max(
      160,
      screenWidth - 32,
    );

    const targetWidth = message
      ? maxWidth
      : Math.min(220, maxWidth);

    const targetHeight = message
      ? options.actionLabel
        ? 112
        : 82
      : options.actionLabel
        ? 78
        : 48;

    widthAnim.value = withSpring(
      targetWidth,
      SPRING_CONFIG,
    );

    heightAnim.value = withSpring(
      targetHeight,
      SPRING_CONFIG,
    );

    translateYAnim.value = withSpring(
      Platform.OS === 'ios' ? 8 : 12,
      SPRING_CONFIG,
    );

    scaleAnim.value = withSpring(1, SPRING_CONFIG);

    opacityAnim.value = withTiming(1, {
      duration: 220,
    });

    // Loading notifications stay until explicitly dismissed.
    const duration = options.duration ?? 4000;

    if (type !== 'loading' && duration > 0) {
      timerRef.current = setTimeout(() => {
        // Do not dismiss a newer notification.
        if (
          mountedRef.current &&
          versionRef.current === version
        ) {
          hideIsland();
        }
      }, duration);
    }
  }, [
    clearTimer,
    screenWidth,
    hideIsland,
    widthAnim,
    heightAnim,
    opacityAnim,
    translateYAnim,
    scaleAnim,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearTimer();

      cancelAnimation(widthAnim);
      cancelAnimation(heightAnim);
      cancelAnimation(opacityAnim);
      cancelAnimation(translateYAnim);
      cancelAnimation(scaleAnim);
    };
  }, [
    clearTimer,
    widthAnim,
    heightAnim,
    opacityAnim,
    translateYAnim,
    scaleAnim,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: widthAnim.value,
    height: heightAnim.value,
    opacity: opacityAnim.value,
    transform: [
      { translateY: translateYAnim.value },
      { scale: scaleAnim.value },
    ],
  }));

  const renderIcon = () => {
    const color = COLORS[island.type];
    const size = 23;

    switch (island.type) {
      case 'success':
        return (
          <CheckCircle2
            size={size}
            color={color}
          />
        );

      case 'error':
        return (
          <AlertTriangle
            size={size}
            color={color}
          />
        );

      case 'warning':
        return (
          <AlertTriangle
            size={size}
            color={color}
          />
        );

      case 'loading':
        return (
          <Animated.View>
            <LoaderCircle
              size={size}
              color={color}
            />
          </Animated.View>
        );

      case 'info':
      default:
        return (
          <Info
            size={size}
            color={color}
          />
        );
    }
  };

  return (
    <DynamicIslandContext.Provider
      value={{ showIsland, hideIsland }}
    >
      {children}

      {island.visible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.container,
            { maxWidth: screenWidth - 32 },
            animatedStyle,
          ]}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              {renderIcon()}
            </View>

            <View style={styles.textContainer}>
              <Text
                style={styles.title}
                numberOfLines={1}
              >
                {island.title}
              </Text>

              {!!island.message && (
                <Text
                  style={styles.message}
                  numberOfLines={2}
                >
                  {island.message}
                </Text>
              )}

              {!!island.actionLabel && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={island.actionLabel}
                  style={styles.actionButton}
                  onPress={() => {
                    const action = island.onAction;

                    hideIsland();
                    action?.();
                  }}
                >
                  <Text style={styles.actionText}>
                    {island.actionLabel}
                  </Text>
                </Pressable>
              )}
            </View>

            {island.dismissible && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق الإشعار"
                hitSlop={10}
                onPress={hideIsland}
                style={styles.closeButton}
              >
                <X
                  size={16}
                  color="#A1A1AA"
                />
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </DynamicIslandContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 0 : 8,
    alignSelf: 'center',
    backgroundColor: '#171719',
    borderRadius: 30,
    zIndex: 99999,
    elevation: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },

  content: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },

  iconContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textContainer: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  title: {
    width: '100%',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },

  message: {
    width: '100%',
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    textAlign: 'right',
  },

  actionButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },

  actionText: {
    color: '#64D2FF',
    fontSize: 12,
    fontWeight: '700',
  },

  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
