import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera, Flame, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse } from 'react-native-svg';

import { track } from '@/analytics/posthog';
import { PressableScale } from '@/components/pressable-scale';
import { ResultsWash } from '@/components/results-wash';
import { ScannedDrinkCard } from '@/components/scanned-drink-card';
import { enterSoft, softEasing } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import { CATEGORIES, DRINK_CATEGORY_IDS, type DrinkCategory } from '@/data/menu';
import { setShowNutrition, useShowNutrition } from '@/data/nutrition-pref';
import { PREMIUM_AVAILABLE, useIsPremium } from '@/data/premium';
import { scanMenu } from '@/data/scan-menu';
import { retryScan, useScanSession, type ScanActivity, type ScanSession } from '@/data/scan-session';

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

type FilterId = 'all' | DrinkCategory;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  ...CATEGORIES.map((category) => ({ id: category.id, label: category.label })),
];

// The footer's compact wave — same stagger as the full-screen headline.
const FOOTER_SEGMENTS = ['Reading ', 'the ', 'next ', 'page', '.', '.', '.'];
const FOOTER_TEXT: TextStyle = { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26, color: colors.ink };

function toFilterId(value: string | string[] | undefined): FilterId {
  return typeof value === 'string' && (DRINK_CATEGORY_IDS as readonly string[]).includes(value)
    ? (value as DrinkCategory)
    : 'all';
}

export default function Results() {
  const session = useScanSession();
  const params = useLocalSearchParams<{ category?: string }>();
  // Honor the chip's category param only if there were drinks when this screen
  // opened — a chip tapped on an empty session must not filter whatever the
  // user scans next from the blank canvas.
  const [initialFilter] = useState<FilterId>(() =>
    session.drinks.length > 0 ? toFilterId(params.category) : 'all'
  );

  if (session.drinks.length === 0) {
    if (session.activity.status === 'scanning') {
      return <ScanningState />;
    }
    if (session.activity.status === 'error') {
      return <ErrorState message={session.activity.message} />;
    }
    return <EmptyState />;
  }
  return <ReadyResults session={session} initialFilter={initialFilter} />;
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
function ReadyResults({ session, initialFilter }: { session: ScanSession; initialFilter: FilterId }) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState(initialFilter);
  const drinks = filter === 'all' ? session.drinks : session.drinks.filter((drink) => drink.category === filter);

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
            {session.venueName ?? 'Your Menu'}
          </Text>
          <FilterRow
            filter={filter}
            onChange={(id) => {
              track('category_selected', { category: id, screen: 'results' });
              setFilter(id);
            }}
          />
          {PREMIUM_AVAILABLE ? <NutritionPill /> : null}
          {drinks.length > 0 ? (
            <View style={{ gap: 20, marginTop: 24 }}>
              {drinks.map((drink) => (
                <ScannedDrinkCard key={drink.id} drink={drink} />
              ))}
            </View>
          ) : (
            <FilteredEmpty filter={filter} />
          )}
          <ListFooter activity={session.activity} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// The category rail: a horizontal row of pills, the active one inverted to ink.
function FilterRow({ filter, onChange }: { filter: FilterId; onChange: (id: FilterId) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 20, marginHorizontal: -layout.gutter, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: 8 }}>
      {FILTERS.map((item) => {
        const active = item.id === filter;
        return (
          <PressableScale
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show ${item.label.toLowerCase()}`}
            onPress={() => onChange(item.id)}
            style={{
              backgroundColor: active ? colors.ink : colors.pill,
              borderRadius: 999,
              borderCurve: 'continuous',
              paddingVertical: 6,
              paddingHorizontal: 16,
              boxShadow: shadows.pill,
            }}>
            <Text style={{ fontFamily: fonts.hand, fontSize: 19, lineHeight: 21, color: active ? colors.tile : colors.ink }}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

// The premium rail: one pill below the filters — a lock that opens the paywall,
// then, once bought, an inverted-ink toggle for the card nutrition lines.
function NutritionPill() {
  const premium = useIsPremium();
  const showNutrition = useShowNutrition();
  const showing = premium && showNutrition;
  const label = !premium ? 'Unlock nutrition' : showing ? 'Hide nutrition' : 'Show nutrition';

  return (
    <View style={{ flexDirection: 'row', marginTop: 12 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ selected: showing }}
        accessibilityLabel={label}
        onPress={() => {
          if (premium) {
            setShowNutrition(!showNutrition);
          } else {
            track('paywall_viewed', { source: 'nutrition_pill' });
            router.push('/paywall');
          }
        }}
        style={{
          backgroundColor: showing ? colors.ink : colors.pill,
          borderRadius: 999,
          borderCurve: 'continuous',
          paddingVertical: 6,
          paddingHorizontal: 16,
          boxShadow: shadows.pill,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {premium ? (
            <Flame size={14} color={showing ? colors.tile : colors.ink} strokeWidth={2} />
          ) : (
            <Lock size={14} color={colors.ink} strokeWidth={2} />
          )}
          <Text style={{ fontFamily: fonts.hand, fontSize: 19, lineHeight: 21, color: showing ? colors.tile : colors.ink }}>
            Nutrition
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

// A chosen filter with nothing under it yet — the menu hasn't surfaced any.
function FilteredEmpty({ filter }: { filter: FilterId }) {
  const label = CATEGORIES.find((category) => category.id === filter)?.label.toLowerCase() ?? 'drinks';
  return (
    <View style={{ alignItems: 'center', marginTop: 48 }}>
      <Text
        style={{
          fontFamily: fonts.hand,
          fontSize: 26,
          lineHeight: 30,
          color: colors.ink,
          alignSelf: 'stretch',
          textAlign: 'center',
        }}>
        Nothing here yet
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 21, color: colors.body, marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
        No {label} on this menu so far.
      </Text>
    </View>
  );
}

// Below the cards, the session's live edge: a scan in progress, a soft inline
// failure, or the invitation to add the next page.
function ListFooter({ activity }: { activity: ScanActivity }) {
  if (activity.status === 'scanning') {
    return (
      <View
        accessible
        accessibilityLabel="Reading the next page…"
        style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
        {FOOTER_SEGMENTS.map((segment, index) => (
          <BlinkSegment key={index} text={segment} delay={index * DOT_STAGGER_MS} textStyle={FOOTER_TEXT} />
        ))}
      </View>
    );
  }

  if (activity.status === 'error') {
    return (
      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Text
          style={{
            fontFamily: fonts.hand,
            fontSize: 22,
            lineHeight: 26,
            color: colors.ink,
            alignSelf: 'stretch',
            textAlign: 'center',
          }}>
          The ink smudged
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: colors.body,
            marginTop: 4,
            textAlign: 'center',
            maxWidth: 280,
          }}>
          {activity.message}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={() => retryScan()}
          style={{
            marginTop: 14,
            backgroundColor: colors.ink,
            borderRadius: 999,
            paddingVertical: 10,
            paddingHorizontal: 26,
            boxShadow: shadows.pill,
          }}>
          <Text style={{ color: colors.tile, fontSize: 15, fontWeight: '600' }}>Try again</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Scan another page"
      onPress={scanMenu}
      style={{
        marginTop: 28,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.pill,
        borderRadius: 999,
        borderCurve: 'continuous',
        paddingVertical: 11,
        paddingHorizontal: 24,
        boxShadow: shadows.pill,
      }}>
      <Camera size={17} color={colors.ink} strokeWidth={2} />
      <Text style={{ fontFamily: fonts.hand, fontSize: 20, lineHeight: 24, color: colors.ink }}>
        Scan another page
      </Text>
    </PressableScale>
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
function BlinkSegment({ text, delay, textStyle = HEADLINE_TEXT }: { text: string; delay: number; textStyle?: TextStyle }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(delay, withRepeat(withTiming(1, DOT_TIMING), -1, true)));
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + v.get() * 0.75 }));
  return <Animated.Text style={[textStyle, style]}>{text}</Animated.Text>;
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
