import { Image } from 'expo-image';
import { openURL } from 'expo-linking';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics/posthog';
import { CategoryArt } from '@/components/category-art';
import { PressableScale } from '@/components/pressable-scale';
import { enterSoft } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import {
  CURRENT_AGE_GATE_VERSION,
  confirmLegalAge,
  declineLegalAgeForSession,
  useLegalAgeDeclinedForSession,
} from '@/data/legal-age';
import { getSavedFirstName } from '@/data/user-name';

const TERMS_URL = 'https://www.sipelle.app/terms';
const PRIVACY_URL = 'https://www.sipelle.app/privacy';
const SUPPORT_URL = 'mailto:info@sipelle.app';

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => void openURL(url)}
      style={styles.legalLink}>
      <Text style={styles.legalLinkText}>{label}</Text>
    </PressableScale>
  );
}

function LegalLinks({ includeSupport = false }: { includeSupport?: boolean }) {
  return (
    <View accessibilityRole="summary" style={styles.legalLinks}>
      <LegalLink label="Terms of Use" url={TERMS_URL} />
      <Text style={styles.separator}>·</Text>
      <LegalLink label="Privacy Policy" url={PRIVACY_URL} />
      {includeSupport ? (
        <>
          <Text style={styles.separator}>·</Text>
          <LegalLink label="Contact support" url={SUPPORT_URL} />
        </>
      ) : null}
    </View>
  );
}

export default function AgeGate() {
  const insets = useSafeAreaInsets();
  const declined = useLegalAgeDeclinedForSession();

  const confirm = () => {
    const isNewConfirmation = confirmLegalAge();
    if (isNewConfirmation) {
      track('legal_age_confirmed', { gate_version: CURRENT_AGE_GATE_VERSION });
    }
    router.replace(getSavedFirstName() ? '/home' : '/welcome');
  };

  return (
    <View style={styles.screen}>
      <Image
        source={require('@/assets/images/sipelle/bg-home-wash.png')}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 28,
            paddingBottom: insets.bottom + 28,
          },
        ]}>
        <Animated.View entering={enterSoft} style={styles.centered}>
          <View style={styles.art}>
            <CategoryArt kind="wine" size={88} />
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>
              {declined ? 'Sipelle is for adults' : 'Before we pour'}
            </Text>

            {declined ? (
              <>
                <Text style={styles.body}>
                  Sipelle is only available to people of legal drinking age where they live. Please close the app.
                </Text>
                <View style={styles.declinedLinks}>
                  <LegalLinks includeSupport />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  Sipelle is for people of legal drinking age where they live. Please confirm that you meet that
                  requirement.
                </Text>
                <Text style={styles.responsible}>Enjoy responsibly. Never drink and drive.</Text>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="I’m of legal drinking age"
                  onPress={confirm}
                  style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>I’m of legal drinking age</Text>
                </PressableScale>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="I’m not of legal drinking age"
                  onPress={declineLegalAgeForSession}
                  style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>I’m not of legal drinking age</Text>
                </PressableScale>

                <Text style={styles.acknowledgement}>
                  By continuing, you agree to the Terms of Use and acknowledge the Privacy Policy.
                </Text>
                <LegalLinks />
              </>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.washMint,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingRight: layout.gutter,
    paddingLeft: layout.gutter,
  },
  centered: {
    alignItems: 'center',
  },
  art: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: colors.tile,
    boxShadow: shadows.tile,
    overflow: 'hidden',
    zIndex: 1,
    marginBottom: -44,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.tile,
    borderRadius: 28,
    borderCurve: 'continuous',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    boxShadow: shadows.card,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    maxWidth: 310,
    color: colors.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  responsible: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    minHeight: 50,
    marginTop: 24,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: colors.rose,
    boxShadow: shadows.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    alignSelf: 'stretch',
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  acknowledgement: {
    marginTop: 12,
    maxWidth: 310,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  legalLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  legalLinkText: {
    color: colors.body,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  separator: {
    color: colors.muted,
    fontSize: 12,
  },
  declinedLinks: {
    marginTop: 22,
  },
});
