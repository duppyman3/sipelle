import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse } from 'react-native-svg';

import { DrinkCard } from '@/components/drink-card';
import { PressableScale } from '@/components/pressable-scale';
import { ResultsWash } from '@/components/results-wash';
import { ScannedDrinkCard } from '@/components/scanned-drink-card';
import { Toast, type ToastData } from '@/components/toast';
import { enterSoft, softEasing } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import { DRINKS, VENUE_NAME } from '@/data/menu';
import { retryScan, useScanSession, type SessionDrink } from '@/data/scan-session';

// Slow breath for the scanning motif; module scope so React Compiler never
// rebuilds it per render.
const PULSE_TIMING = { duration: 1500, easing: softEasing };

export default function Results() {
  const session = useScanSession();

  switch (session.status) {
    case 'scanning':
      return <ScanningState />;
    case 'error':
      return <ErrorState message={session.message} />;
    case 'ready':
      return <ReadyResults venueName={session.venueName} drinks={session.drinks} />;
    default:
      return <IdleResults />;
  }
}

// The static demo reached via the Home category chips — unchanged from before
// the scan flow existed, toast wiring and all.
function IdleResults() {
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
          <BackButton />
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

// A finished scan: the same scrolling layout, with the venue header and cards
// whose photos fill in as they arrive.
function ReadyResults({ venueName, drinks }: { venueName: string | null; drinks: SessionDrink[] }) {
  const insets = useSafeAreaInsets();

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
          <BackButton />
          <Text
            style={{
              fontFamily: fonts.serif,
              fontSize: 30,
              lineHeight: 32,
              textAlign: 'center',
              marginTop: -8,
              color: colors.ink,
            }}>
            {venueName ?? 'Your Menu'}
          </Text>
          <View style={{ gap: 20, marginTop: 24 }}>
            {drinks.map((drink) => (
              <ScannedDrinkCard key={drink.id} drink={drink} />
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// While the menu is being read: a breathing pigment bloom over the wash.
function ScanningState() {
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, PULSE_TIMING), -1, true));
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.get() * 0.35,
    transform: [{ scale: 0.94 + pulse.get() * 0.06 }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.washCream }}>
      <ResultsWash />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 8,
          paddingHorizontal: layout.gutter,
          paddingBottom: insets.bottom + 32,
        }}>
        <BackButton />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View entering={enterSoft} style={{ alignItems: 'center' }}>
            <Animated.View style={pulseStyle}>
              <PigmentBloom size={200} />
            </Animated.View>
            <Text
              style={{
                fontFamily: fonts.hand,
                fontSize: 32,
                lineHeight: 36,
                color: colors.ink,
                marginTop: 4,
              }}>
              Reading your menu…
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 21,
                color: colors.muted,
                marginTop: 8,
                textAlign: 'center',
                maxWidth: 280,
              }}>
              Sip back and relax — this takes a moment.
            </Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

// The scan failed: a soft apology and a single retry.
function ErrorState({ message }: { message: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.washCream }}>
      <ResultsWash />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 8,
          paddingHorizontal: layout.gutter,
          paddingBottom: insets.bottom + 32,
        }}>
        <BackButton />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View entering={enterSoft} style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: fonts.hand,
                fontSize: 32,
                lineHeight: 36,
                color: colors.ink,
              }}>
              The ink smudged
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 21,
                color: colors.body,
                marginTop: 8,
                textAlign: 'center',
                maxWidth: 280,
              }}>
              {message}
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => retryScan()}
              style={{
                marginTop: 22,
                backgroundColor: colors.ink,
                borderRadius: 999,
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: 'center',
                boxShadow: shadows.pill,
              }}>
              <Text style={{ color: colors.tile, fontSize: 16, fontWeight: '600' }}>Try again</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function BackButton() {
  return (
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
  );
}

// Layered translucent pools in the brand washes — the PastelDisc language at
// hero scale, bleeding into one another like loaded pigment.
function PigmentBloom({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Ellipse cx={84} cy={92} rx={62} ry={58} fill={colors.washMint} opacity={0.7} />
      <Ellipse cx={118} cy={104} rx={58} ry={60} fill={colors.rose} opacity={0.32} />
      <Ellipse cx={104} cy={84} rx={52} ry={50} fill={colors.pill} opacity={0.8} />
      <Ellipse cx={132} cy={78} rx={20} ry={18} fill={colors.washMint} opacity={0.55} />
      <Ellipse cx={74} cy={120} rx={18} ry={16} fill={colors.rose} opacity={0.28} />
      <Ellipse cx={100} cy={112} rx={30} ry={26} fill={colors.pill} opacity={0.5} />
    </Svg>
  );
}
