import { openURL } from 'expo-linking';
import { Redirect, router } from 'expo-router';
import { Candy, Flame, Wheat, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics/posthog';
import { PressableScale } from '@/components/pressable-scale';
import { ResultsWash } from '@/components/results-wash';
import { enterSoft } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import { setShowNutrition } from '@/data/nutrition-pref';
import { PREMIUM_AVAILABLE, purchasePremium, restorePurchases, usePremiumPrice } from '@/data/premium';

// The paid nutrition upsell: a plain fade route (not a modal sheet) so the
// close affordance and transition read the same on every platform.
export default function Paywall() {
  const insets = useSafeAreaInsets();
  const price = usePremiumPrice();
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!PREMIUM_AVAILABLE) {
    return <Redirect href="/home" />;
  }

  // Close and post-purchase both return to results; replace covers a deep link
  // into the paywall with no back stack to pop.
  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/results');
    }
  };

  const onUnlock = async () => {
    if (busy) {
      return;
    }
    setNotice(null);
    setBusy('purchase');
    track('purchase_started');
    const result = await purchasePremium();
    if (result.ok) {
      track('purchase_result', { outcome: 'success' });
      // Flip the toggle on before leaving so results inks in the nutrition live.
      setShowNutrition(true);
      close();
      return;
    }
    track('purchase_result', { outcome: result.reason });
    if (result.reason === 'failed') {
      setNotice('The purchase could not be completed. Please try again.');
    }
    setBusy(null);
  };

  const onRestore = async () => {
    if (busy) {
      return;
    }
    setNotice(null);
    setBusy('restore');
    const result = await restorePurchases();
    track('restore_result', {
      outcome: result.ok ? (result.restored ? 'restored' : 'nothing_to_restore') : 'failed',
    });
    if (result.ok && result.restored) {
      // Restore only re-grants entitlement; the toggle keeps its own state.
      close();
      return;
    }
    if (result.ok) {
      setNotice('No previous purchase found.');
    } else {
      setNotice("Couldn't reach the store. Try again.");
    }
    setBusy(null);
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
          flexGrow: 1,
        }}>
        <Animated.View entering={enterSoft} style={{ flex: 1 }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            style={{
              width: 44,
              height: 44,
              marginLeft: -10, // optically aligns the 24px glyph to the 20px gutter
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'flex-start',
            }}>
            <X size={24} color={colors.ink} strokeWidth={2} />
          </PressableScale>

          <Text
            style={{
              fontFamily: fonts.serif,
              fontSize: 30,
              lineHeight: 34,
              textAlign: 'center',
              color: colors.ink,
            }}>
            Know every pour
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 21,
              color: colors.body,
              marginTop: 8,
              textAlign: 'center',
              alignSelf: 'center',
              maxWidth: 300,
            }}>
            Unlock nutrition for every drink Sipelle scans.
          </Text>

          {/* The three paid fields, mirrored from the drink card's nutrition line */}
          <View
            style={{
              backgroundColor: colors.tile,
              borderRadius: 28,
              borderCurve: 'continuous',
              padding: 20,
              gap: 14,
              marginTop: 24,
              boxShadow: shadows.card,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Flame size={18} color={colors.ink} strokeWidth={2} />
              <Text style={{ fontSize: 15, color: colors.body, flex: 1 }}>Calories for every drink</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Candy size={18} color={colors.ink} strokeWidth={2} />
              <Text style={{ fontSize: 15, color: colors.body, flex: 1 }}>Sugar grams at a glance</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Wheat size={18} color={colors.ink} strokeWidth={2} />
              <Text style={{ fontSize: 15, color: colors.body, flex: 1 }}>Carbs to round it out</Text>
            </View>
          </View>

          {/* Price — the single most prominent pricing element (store rule).
              Phase 2 swaps usePremiumPrice() for the localized offering price;
              this JSX does not change. */}
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: colors.ink,
              textAlign: 'center',
              marginTop: 28,
            }}>
            {price}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.muted,
              marginTop: 6,
              textAlign: 'center',
              alignSelf: 'center',
              maxWidth: 300,
            }}>
            Auto-renews yearly until cancelled. Cancel anytime in your App Store or Google Play settings.
          </Text>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Unlock Nutrition"
            onPress={onUnlock}
            style={{
              marginTop: 20,
              backgroundColor: colors.rose,
              borderRadius: 999,
              borderCurve: 'continuous',
              paddingVertical: 14,
              alignItems: 'center',
              boxShadow: shadows.pill,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>
              {busy === 'purchase' ? 'Unlocking…' : 'Unlock Nutrition'}
            </Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            onPress={onRestore}
            style={{ marginTop: 14, alignSelf: 'center' }}>
            <Text style={{ fontSize: 14, color: colors.body, textDecorationLine: 'underline' }}>
              {busy === 'restore' ? 'Restoring…' : 'Restore Purchases'}
            </Text>
          </PressableScale>

          {notice ? (
            <Text style={{ fontSize: 13, color: colors.body, textAlign: 'center', marginTop: 12 }}>{notice}</Text>
          ) : null}

          <View style={{ flex: 1 }} />

          {/* Required store links; the pages go live in phase 2. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
            <PressableScale accessibilityRole="link" onPress={() => openURL('https://www.sipelle.app/terms')}>
              <Text style={{ fontSize: 12, color: colors.muted, textDecorationLine: 'underline' }}>Terms of Use</Text>
            </PressableScale>
            <Text style={{ fontSize: 12, color: colors.muted }}>{' · '}</Text>
            <PressableScale accessibilityRole="link" onPress={() => openURL('https://www.sipelle.app/privacy')}>
              <Text style={{ fontSize: 12, color: colors.muted, textDecorationLine: 'underline' }}>Privacy Policy</Text>
            </PressableScale>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
