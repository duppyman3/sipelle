import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { enterSoft } from '@/constants/motion';
import { colors, fonts, layout, shadows } from '@/constants/theme';
import { saveFirstName } from '@/data/user-name';

export default function Welcome() {
  const [name, setName] = useState('');
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return; // the keyboard's "done" key fires regardless of content
    }
    saveFirstName(trimmed);
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
          <Animated.View
            entering={enterSoft}
            style={{
              backgroundColor: colors.card,
              borderRadius: 28,
              borderCurve: 'continuous',
              padding: 24,
              boxShadow: shadows.card,
            }}>
            <Text style={{ fontFamily: fonts.hand, fontSize: 32, lineHeight: 34, color: colors.ink }}>
              What&apos;s your first name?
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
              style={{
                marginTop: 16,
                backgroundColor: colors.tile,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 12,
                paddingHorizontal: 16,
                fontSize: 17,
                color: colors.ink,
              }}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Continue"
              disabled={!canSubmit}
              onPress={submit}
              style={{
                marginTop: 16,
                backgroundColor: colors.ink,
                borderRadius: 999,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: canSubmit ? 1 : 0.4,
              }}>
              <Text style={{ color: colors.washCream, fontSize: 16, fontWeight: '600' }}>
                Continue
              </Text>
            </PressableScale>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
