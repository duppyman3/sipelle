import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { getSavedFirstName } from '@/data/user-name';

export default function Splash() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(getSavedFirstName() ? '/home' : '/welcome');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.washSplash }}>
      <Image
        source={require('@/assets/images/sipelle/splash-full.png')}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
