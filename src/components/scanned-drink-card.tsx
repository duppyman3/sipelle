import { Image } from 'expo-image';
import { RotateCcw } from 'lucide-react-native';
import { useEffect } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';

import { PressableScale } from '@/components/pressable-scale';
import { softEasing } from '@/constants/motion';
import { colors, fonts, shadows } from '@/constants/theme';
import { retryDrinkImage, type SessionDrink } from '@/data/scan-session';

// Rose pigment softened toward the card — a gentle "smudge" wash for a failed
// image, never an alarming red.
const ROSE_WASH = '#F1D3D8';

// Slow breath for every tile still waiting on its photo; module scope so React
// Compiler never rebuilds it per render.
const PULSE_TIMING = { duration: 1500, easing: softEasing };

// The image tile is a fixed 104×109 with a 26px radius, applied to every tile
// state so cards keep one silhouette while photos are still loading.
const TILE_BASE: ViewStyle = {
  width: 104,
  height: 109,
  borderRadius: 26,
  borderCurve: 'continuous',
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: shadows.tile,
};

export function ScannedDrinkCard({ drink }: { drink: SessionDrink }) {
  const { calories, abvPercent } = drink.nutrition;
  const nutritionParts: string[] = [];
  if (calories != null) {
    nutritionParts.push(`≈ ${Math.round(calories)} cal`);
  }
  if (abvPercent != null) {
    nutritionParts.push(`${Math.round(abvPercent)}% ABV`);
  }
  const nutrition = nutritionParts.join(' · ');

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
        backgroundColor: colors.card,
        borderRadius: 28,
        borderCurve: 'continuous',
        padding: 16,
        boxShadow: shadows.card,
      }}>
      <DrinkTile drink={drink} />
      <View style={{ flex: 1, gap: 5, paddingTop: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.serif,
              fontSize: 21,
              lineHeight: 22,
              color: colors.ink,
            }}>
            {drink.name}
          </Text>
          {drink.price != null ? (
            <View
              style={{
                backgroundColor: colors.pill,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 6,
                paddingHorizontal: 11,
                boxShadow: shadows.pill,
              }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{drink.price}</Text>
            </View>
          ) : null}
        </View>
        {nutrition ? <Text style={{ fontSize: 13, color: colors.muted }}>{nutrition}</Text> : null}
        <Text numberOfLines={3} style={{ fontSize: 14, lineHeight: 19, color: colors.body }}>
          {drink.visualDescription}
        </Text>
      </View>
    </View>
  );
}

function DrinkTile({ drink }: { drink: SessionDrink }) {
  if (drink.imageStatus === 'done' && drink.imageUri) {
    return (
      <View style={[TILE_BASE, { backgroundColor: colors.tile }]}>
        <Image
          source={{ uri: drink.imageUri }}
          contentFit="cover"
          transition={400}
          recyclingKey={drink.id}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  if (drink.imageStatus === 'error') {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Retry drink image"
        onPress={() => retryDrinkImage(drink.id)}
        style={[TILE_BASE, { backgroundColor: ROSE_WASH }]}>
        <RotateCcw size={20} color={colors.ink} strokeWidth={2} />
      </PressableScale>
    );
  }

  // queued | generating — a soft pigment pool that pulses until the photo lands.
  return (
    <View
      accessible
      accessibilityLabel="Generating drink image"
      style={[TILE_BASE, { backgroundColor: colors.pill }]}>
      <TilePlaceholder />
    </View>
  );
}

function TilePlaceholder() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, PULSE_TIMING), -1, true));
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.get() * 0.65,
    transform: [{ scale: 0.9 + pulse.get() * 0.12 }],
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Svg width={76} height={76} viewBox="0 0 76 76">
        <Ellipse cx={32} cy={36} rx={24} ry={22} fill={colors.washMint} opacity={0.85} />
        <Ellipse cx={46} cy={42} rx={22} ry={24} fill={colors.rose} opacity={0.4} />
        <Ellipse cx={40} cy={32} rx={18} ry={17} fill={colors.washMint} opacity={0.7} />
        <Ellipse cx={50} cy={30} rx={9} ry={8} fill={colors.rose} opacity={0.35} />
      </Svg>
    </Animated.View>
  );
}
