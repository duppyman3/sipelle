import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { StarRating } from '@/components/star-rating';
import { colors, fonts, shadows } from '@/constants/theme';
import type { Drink } from '@/data/menu';

export function DrinkCard({ drink, onPress }: { drink: Drink; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${drink.name}, ${drink.price}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
        backgroundColor: colors.card,
        borderRadius: 28,
        borderCurve: 'continuous',
        padding: 16,
        boxShadow: shadows.card,
      }}>
      <View
        style={{
          width: 104,
          height: 109,
          borderRadius: 26,
          borderCurve: 'continuous',
          backgroundColor: colors.tile,
          boxShadow: shadows.tile,
          overflow: 'hidden',
        }}>
        <Image source={drink.image} contentFit="cover" style={{ width: '100%', height: '100%' }} />
      </View>
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
        </View>
        <StarRating rating={drink.rating} />
        <Text style={{ fontSize: 13.5, lineHeight: 18, color: colors.body }}>
          {drink.description}
        </Text>
      </View>
    </PressableScale>
  );
}
