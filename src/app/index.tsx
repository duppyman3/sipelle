import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterSplashCaption } from '@/constants/motion';
import { colors } from '@/constants/theme';
import { getSavedFirstName } from '@/data/user-name';

export default function Splash() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tap to begin"
      style={{ flex: 1, backgroundColor: colors.washSplash }}
      onPress={() => router.replace(getSavedFirstName() ? '/home' : '/welcome')}>
      <Image
        source={require('@/assets/images/sipelle/splash-full.png')}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        entering={enterSplashCaption}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 46,
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
        <Text
          style={{
            fontSize: 13,
            letterSpacing: 1.56, // 0.12em × 13px — RN letterSpacing is in points
            textTransform: 'uppercase',
            color: colors.muted,
            textAlign: 'center',
          }}>
          Tap to begin
        </Text>
      </Animated.View>
    </Pressable>
  );
}
