import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrinkCard } from '@/components/drink-card';
import { PressableScale } from '@/components/pressable-scale';
import { ResultsWash } from '@/components/results-wash';
import { Toast, type ToastData } from '@/components/toast';
import { enterSoft } from '@/constants/motion';
import { colors, fonts, layout } from '@/constants/theme';
import { DRINKS, VENUE_NAME } from '@/data/menu';

export default function Results() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastData | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCounter = useRef(0);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  // Placeholder behavior per the handoff — replace with the real favourites
  // flow when it exists.
  const showToast = (name: string) => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, message: `${name} — added to favourites` });
    dismissTimer.current = setTimeout(() => setToast(null), 1600);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.washCream }}>
      <ResultsWash />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: layout.gutter,
          paddingBottom: insets.bottom + 32,
        }}>
        <Animated.View entering={enterSoft}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              marginLeft: -10, // optically aligns the 24px glyph to the 20px gutter
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'flex-start',
            }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </PressableScale>
          <Text
            style={{
              fontFamily: fonts.serif,
              fontSize: 30,
              lineHeight: 32,
              textAlign: 'center',
              marginTop: -8,
              color: colors.ink,
            }}>
            {VENUE_NAME}
          </Text>
          <View style={{ gap: 20, marginTop: 24 }}>
            {DRINKS.map((drink) => (
              <DrinkCard key={drink.id} drink={drink} onPress={() => showToast(drink.name)} />
            ))}
          </View>
        </Animated.View>
      </ScrollView>
      <Toast toast={toast} />
    </View>
  );
}
