import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { track } from '@/analytics/posthog';
import { CategoryArt } from '@/components/category-art';
import { PressableScale } from '@/components/pressable-scale';
import { enterSoft } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import { saveFirstName } from '@/data/user-name';

// Rose at ~35% over white — a soft tint for the disabled Continue, so the
// pill never turns muddy gray.
const ROSE_TINT = '#F7E0E4';

export default function Welcome() {
  const [name, setName] = useState('');
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return; // the keyboard's "done" key fires regardless of content
    }
    saveFirstName(trimmed);
    track('onboarding_completed', { $set: { first_name: trimmed } });
    router.replace('/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.washMint }}>
      <Image
        source={require('@/assets/images/sipelle/bg-home-wash.png')}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: layout.gutter,
            paddingBottom: 48,
          }}>
          <Animated.View entering={enterSoft} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 999,
                backgroundColor: colors.tile,
                boxShadow: shadows.tile,
                overflow: 'hidden',
                zIndex: 1,
                marginBottom: -44,
              }}>
              <CategoryArt kind="cocktails" size={88} />
            </View>
            <View
              style={{
                alignSelf: 'stretch',
                backgroundColor: colors.tile,
                borderRadius: 28,
                borderCurve: 'continuous',
                paddingTop: 58,
                paddingHorizontal: 24,
                paddingBottom: 24,
                boxShadow: shadows.card,
                alignItems: 'center',
              }}>
              <Text style={{ fontFamily: fonts.hand, fontSize: 44, lineHeight: 46, color: colors.ink }}>
                Hello!
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: colors.body, marginTop: 6 }}>
                What should we call you?
              </Text>
              <TextInput
                onChangeText={setName}
                placeholder="First name"
                placeholderTextColor={colors.muted}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={submit}
                textAlign="center"
                style={{
                  alignSelf: 'stretch',
                  marginTop: 18,
                  backgroundColor: colors.pill,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  fontSize: 17,
                  color: colors.ink,
                  boxShadow: shadows.tile,
                }}
              />
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Continue"
                disabled={!canSubmit}
                onPress={submit}
                style={{
                  alignSelf: 'stretch',
                  marginTop: 14,
                  backgroundColor: canSubmit ? colors.rose : ROSE_TINT,
                  borderRadius: 999,
                  paddingVertical: 14,
                  alignItems: 'center',
                  boxShadow: canSubmit ? shadows.pill : undefined,
                }}>
                <Text
                  style={{
                    color: canSubmit ? colors.ink : colors.muted,
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                  Continue
                </Text>
              </PressableScale>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
