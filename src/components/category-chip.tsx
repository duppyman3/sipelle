import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { track } from '@/analytics/posthog';
import { CategoryArt } from '@/components/category-art';
import { PressableScale } from '@/components/pressable-scale';
import { colors, fonts, shadows } from '@/constants/theme';
import type { Category } from '@/data/menu';

export function CategoryChip({ category }: { category: Category }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${category.label} drinks`}
      onPress={() => {
        track('category_selected', { category: category.id, screen: 'home' });
        router.push({ pathname: '/results', params: { category: category.id } });
      }}
      style={{ width: 96, alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 92,
          height: 92,
          borderRadius: 999,
          backgroundColor: colors.tile,
          boxShadow: shadows.tile,
          overflow: 'hidden',
        }}>
        {'image' in category ? (
          <Image
            source={category.image}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <CategoryArt kind={category.art} size={92} />
        )}
      </View>
      <Text style={{ fontFamily: fonts.hand, fontSize: 22, lineHeight: 22, color: colors.ink }}>
        {category.label}
      </Text>
    </PressableScale>
  );
}
