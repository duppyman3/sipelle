import { Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { enterSoft, softEasing } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import { type ScanCapWarning } from '@/data/scan-session';

// The scan-menu backend returns at most a fixed number of drinks per scan. When
// the photographed menu holds more, a missing pour would otherwise read as a
// broken app — this overlay names the cap warmly and offers a rescan or a
// dismissal. It floats over the results already painting underneath; nothing
// here unmounts them or stops the image queue.

// Animation builders stay at module scope so React Compiler never rebuilds them
// per render. The scrim fades in a touch quicker than the card's enterSoft rise.
const scrimEnter = FadeIn.duration(250).easing(softEasing);

export function ScanCapModal({
  warning,
  onRescan,
  onContinue,
}: {
  warning: ScanCapWarning;
  onRescan: () => void;
  onContinue: () => void;
}) {
  return (
    <Animated.View
      entering={scrimEnter}
      // The scrim is a deliberate dead zone: the two buttons are the only exits,
      // so acknowledging the cap is an explicit choice, not a stray tap-away.
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.scrim,
        alignItems: 'center',
        justifyContent: 'center',
        padding: layout.gutter,
      }}>
      <Animated.View
        entering={enterSoft}
        accessibilityViewIsModal
        style={{
          width: '100%',
          maxWidth: 320,
          backgroundColor: colors.tile,
          borderRadius: 28,
          borderCurve: 'continuous',
          padding: 24,
          alignItems: 'center',
          boxShadow: shadows.card,
        }}>
        {/* stretch + textAlign center guard the RN-Android last-word clip on
            intrinsic-width custom-font text; the entering re-layout re-breaks it. */}
        <Text
          style={{
            fontFamily: fonts.hand,
            fontSize: 32,
            lineHeight: 36,
            color: colors.ink,
            alignSelf: 'stretch',
            textAlign: 'center',
          }}>
          Quite the menu
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: colors.body,
            marginTop: 8,
            textAlign: 'center',
          }}>
          {warning.totalDrinkCount} drinks found, but the app can only bring back{' '}
          {warning.drinkLimit} per scan.
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Rescan the menu"
          onPress={onRescan}
          style={{
            marginTop: 22,
            alignSelf: 'stretch',
            backgroundColor: colors.ink,
            borderRadius: 999,
            borderCurve: 'continuous',
            paddingVertical: 14,
            alignItems: 'center',
            boxShadow: shadows.pill,
          }}>
          <Text style={{ color: colors.tile, fontSize: 16, fontWeight: '600' }}>Rescan</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="View drinks"
          onPress={onContinue}
          style={{
            marginTop: 12,
            alignSelf: 'stretch',
            backgroundColor: colors.pill,
            borderRadius: 999,
            borderCurve: 'continuous',
            paddingVertical: 14,
            alignItems: 'center',
            boxShadow: shadows.pill,
          }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}>View Drinks</Text>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}
