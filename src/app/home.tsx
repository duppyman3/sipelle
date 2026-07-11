import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DecorativeTabBar } from '@/components/decorative-tab-bar';
import { PressableScale } from '@/components/pressable-scale';
import { enterSoft } from '@/constants/motion';
import { colors, fonts, homeGradient, layout, shadows } from '@/constants/theme';
import { CATEGORIES } from '@/data/menu';

export default function Home() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={homeGradient.colors}
        locations={homeGradient.locations}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: layout.gutter,
          paddingBottom: layout.tabBarHeight + insets.bottom + 24,
        }}>
        <Animated.View entering={enterSoft}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flexShrink: 1, paddingTop: 6 }}>
              <Text style={{ fontFamily: fonts.hand, fontSize: 34, lineHeight: 34, color: colors.ink }}>
                Sipelle
              </Text>
              <Text
                style={{
                  fontFamily: fonts.hand,
                  fontSize: 44,
                  lineHeight: 46,
                  marginTop: 14,
                  color: colors.ink,
                }}>
                Hello John!
              </Text>
              <Text
                style={{ fontSize: 13, lineHeight: 18, color: colors.body, maxWidth: 150, marginTop: 8 }}>
                What are you in the mood for today?
              </Text>
            </View>
            <Image
              source={require('@/assets/images/sipelle/hero-cocktail.png')}
              contentFit="cover"
              style={{ width: 210, height: 233, marginTop: -6, marginRight: -10 }}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
            {CATEGORIES.map((category) => (
              <PressableScale
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={`${category.label} drinks`}
                onPress={() => router.push('/results')}
                style={{ width: 96, alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 999,
                    backgroundColor: colors.tile,
                    boxShadow: shadows.tile,
                    overflow: 'hidden',
                  }}>
                  <Image
                    source={category.image}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                </View>
                <Text style={{ fontFamily: fonts.hand, fontSize: 22, lineHeight: 22, color: colors.ink }}>
                  {category.label}
                </Text>
              </PressableScale>
            ))}
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Scan Menu"
            onPress={() => router.push('/results')}
            style={{ alignSelf: 'center', marginTop: 10 }}>
            <Image
              source={require('@/assets/images/sipelle/scan-menu-blob.png')}
              contentFit="contain"
              style={{ width: 190, height: 190 }}
            />
          </PressableScale>
        </Animated.View>
      </ScrollView>
      <DecorativeTabBar />
    </View>
  );
}
