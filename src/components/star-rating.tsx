import { Text } from 'react-native';

import { colors } from '@/constants/theme';

export function StarRating({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <Text
      accessibilityLabel={`Rated ${filled} out of 5`}
      style={{ fontSize: 16, lineHeight: 16, letterSpacing: 2, color: colors.ink }}>
      {'★'.repeat(filled) + '☆'.repeat(5 - filled)}
    </Text>
  );
}
