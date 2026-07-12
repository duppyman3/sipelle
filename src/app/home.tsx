import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { Camera, RotateCcw } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/category-chip';
import { HomeTabBar } from '@/components/home-tab-bar';
import { PressableScale } from '@/components/pressable-scale';
import { enterSoft } from '@/constants/motion';
import { colors, fonts, homeGradient, layout, shadows } from '@/constants/theme';
import { CATEGORIES } from '@/data/menu';
import { clearPremiumForTesting } from '@/data/premium';
import { scanMenu } from '@/data/scan-menu';
import { clearFirstName, getSavedFirstName } from '@/data/user-name';

export default function Home() {
  const insets = useSafeAreaInsets();
  const firstName = getSavedFirstName();

  if (!firstName) {
    return <Redirect href="/welcome" />;
  }

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
          <View style={{ paddingTop: 6 }}>
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
              Hello {firstName}!
            </Text>
            <Text
              style={{ fontSize: 13, lineHeight: 18, color: colors.body, maxWidth: 150, marginTop: 8 }}>
              What are you in the mood for today?
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 }}>
            {CATEGORIES.slice(0, 3).map((category) => (
              <CategoryChip key={category.id} category={category} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 31, marginTop: 20 }}>
            {CATEGORIES.slice(3).map((category) => (
              <CategoryChip key={category.id} category={category} />
            ))}
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Scan Menu"
            onPress={scanMenu}
            style={{
              alignSelf: 'center',
              marginTop: 28,
              width: 160,
              height: 160,
              borderRadius: 999,
              backgroundColor: colors.tile,
              boxShadow: shadows.tile,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Camera size={36} color={colors.ink} strokeWidth={2} />
            <Text style={{ fontFamily: fonts.hand, fontSize: 24, lineHeight: 26, color: colors.ink }}>
              Scan Menu
            </Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
      <HomeTabBar />
      {/* Testing-only: clears the saved name and premium, then restarts the first-run flow. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Reset saved name"
        onPress={() => {
          clearFirstName();
          clearPremiumForTesting();
          router.replace('/');
        }}
        style={{
          position: 'absolute',
          bottom: layout.tabBarHeight + insets.bottom + 12,
          right: 14,
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: colors.tile,
          boxShadow: shadows.tile,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <RotateCcw size={20} color={colors.ink} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}
