import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronDown, Lock, RotateCcw } from 'lucide-react-native';
import { useEffect } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';

import { type DrinkNutrition } from '@/ai/menu-scan';
import { track } from '@/analytics/posthog';
import { PressableScale } from '@/components/pressable-scale';
import { expandTiming, expandTransition, softEasing } from '@/constants/motion';
import { colors, fonts, shadows } from '@/constants/theme';
import { useShowNutrition } from '@/data/nutrition-pref';
import { PREMIUM_AVAILABLE, useIsPremium } from '@/data/premium';
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

export function ScannedDrinkCard({
  drink,
  expanded,
  onToggle,
}: {
  drink: SessionDrink;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <PressableScale
      // Pressable defaults accessible=true, which flattens the subtree on iOS and
      // hides the nested lock/retry controls from VoiceOver.
      accessible={false}
      onPress={onToggle}
      layout={expandTransition}
      style={{
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
        backgroundColor: colors.card,
        borderRadius: 28,
        borderCurve: 'continuous',
        padding: 16,
        overflow: 'hidden',
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
        <NutritionLine nutrition={drink.nutrition} />
        {/* Show drink.description only — never the image-generation visualDescription. */}
        {drink.description ? (
          <>
            <Text
              numberOfLines={expanded ? undefined : 3}
              style={{ fontSize: 14, lineHeight: 19, color: colors.body }}>
              {drink.description}
            </Text>
            <ExpandChevron expanded={expanded} onToggle={onToggle} />
          </>
        ) : null}
      </View>
    </PressableScale>
  );
}

function ExpandChevron({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const turn = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    turn.set(withTiming(expanded ? 1 : 0, expandTiming));
  }, [turn, expanded]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * 180}deg` }],
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? 'Hide full description' : 'Show full description'}
      hitSlop={12}
      onPress={onToggle}
      style={{ alignSelf: 'flex-end' }}>
      <Animated.View style={chevronStyle}>
        <ChevronDown size={16} color={colors.muted} strokeWidth={2} />
      </Animated.View>
    </PressableScale>
  );
}

function NutritionLine({ nutrition }: { nutrition: DrinkNutrition }) {
  const isPremium = useIsPremium();
  const showNutrition = useShowNutrition();

  const { calories, abvPercent, sugarGrams, carbsGrams } = nutrition;
  const hasPremiumData = calories != null || sugarGrams != null || carbsGrams != null;

  // Only tease the paywall when there's locked premium data to reveal — a drink
  // with just ABV shows it plainly rather than baiting an upgrade.
  if (PREMIUM_AVAILABLE && !isPremium && hasPremiumData) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Unlock nutrition"
          hitSlop={8}
          onPress={() => {
            track('paywall_viewed', { source: 'drink_card' });
            router.push('/paywall');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Lock size={12} color={colors.muted} strokeWidth={2} />
          <Text style={{ fontSize: 13, color: colors.muted }}>≈ ··· cal</Text>
        </PressableScale>
        {abvPercent != null ? (
          <Text style={{ fontSize: 13, color: colors.muted }}>· {Math.round(abvPercent)}% ABV</Text>
        ) : null}
      </View>
    );
  }

  if (isPremium && showNutrition) {
    const parts: string[] = [];
    if (calories != null) {
      parts.push(`≈ ${Math.round(calories)} cal`);
    }
    if (sugarGrams != null) {
      parts.push(`${Math.round(sugarGrams)}g sugar`);
    }
    if (carbsGrams != null) {
      parts.push(`${Math.round(carbsGrams)}g carbs`);
    }
    if (abvPercent != null) {
      parts.push(`${Math.round(abvPercent)}% ABV`);
    }
    if (parts.length === 0) {
      return null;
    }
    return <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>{parts.join(' · ')}</Text>;
  }

  if (abvPercent != null) {
    return <Text style={{ fontSize: 13, color: colors.muted }}>{Math.round(abvPercent)}% ABV</Text>;
  }

  return null;
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
