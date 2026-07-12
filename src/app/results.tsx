import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, Text, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse } from 'react-native-svg';

import { PressableScale } from '@/components/pressable-scale';
import { ResultsWash } from '@/components/results-wash';
import { ScannedDrinkCard } from '@/components/scanned-drink-card';
import { enterSoft, softEasing } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import { scanMenu } from '@/data/scan-menu';
import { retryScan, useScanSession, type SessionDrink } from '@/data/scan-session';

// Slow breath for the scanning motif; module scope so React Compiler never
// rebuilds it per render.
const PULSE_TIMING = { duration: 1500, easing: softEasing };
const DOT_TIMING = { duration: 780, easing: softEasing };
const DOT_STAGGER_MS = 260;

// Shared glyph style for every segment of the scanning headline, so the row
// reads as the single line of text it replaced.
const HEADLINE_TEXT: TextStyle = {
  fontFamily: fonts.hand,
  fontSize: 32,
  lineHeight: 36,
  color: colors.ink,
};

// One continuous blink wave across the headline; the trailing spaces after the
// first two words keep the dots hugging 'menu' like the line they replaced.
const HEADLINE_SEGMENTS = ['Reading ', 'your ', 'menu', '.', '.', '.'];

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
      return <EmptyState />;
  }
}

// No scan yet: a still pigment pool and an invitation to point the camera.
function EmptyState() {
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
          <Animated.View entering={enterSoft} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
            <PigmentBloom size={200} />
            {/* stretch + textAlign center guard the RN-Android last-word
                clip on intrinsic-width custom-font text; the entering
                animation's re-layout re-breaks the line. */}
            <Text
              style={{
                fontFamily: fonts.hand,
                fontSize: 32,
                lineHeight: 36,
                color: colors.ink,
                marginTop: 4,
                alignSelf: 'stretch',
                textAlign: 'center',
              }}>
              A blank canvas
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
              Scan a drinks menu and we&apos;ll paint every pour.
            </Text>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Scan a menu"
              onPress={scanMenu}
              style={{
                marginTop: 22,
                backgroundColor: colors.ink,
                borderRadius: 999,
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: 'center',
                boxShadow: shadows.pill,
              }}>
              <Text style={{ color: colors.tile, fontSize: 16, fontWeight: '600' }}>Scan a menu</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </View>
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
            <View
              accessible
              accessibilityLabel="Reading your menu…"
              style={{ marginTop: 4, flexDirection: 'row' }}>
              {HEADLINE_SEGMENTS.map((segment, index) => (
                <BlinkSegment key={index} text={segment} delay={index * DOT_STAGGER_MS} />
              ))}
            </View>
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

// Each word and dot of the scanning headline blinks on the same staggered
// timing, so a single wave of ink travels across the whole line.
function BlinkSegment({ text, delay }: { text: string; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(delay, withRepeat(withTiming(1, DOT_TIMING), -1, true)));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + v.get() * 0.75 }));
  return <Animated.Text style={[HEADLINE_TEXT, style]}>{text}</Animated.Text>;
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
          <Animated.View entering={enterSoft} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
            {/* same last-word-clip guard as EmptyState */}
            <Text
              style={{
                fontFamily: fonts.hand,
                fontSize: 32,
                lineHeight: 36,
                color: colors.ink,
                alignSelf: 'stretch',
                textAlign: 'center',
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
