import { CircleUserRound, House, Search } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout } from '@/constants/theme';

/**
 * Prototype-parity tab bar: purely decorative (no navigation), shown only on
 * Home, hidden from accessibility.
 */
export function DecorativeTabBar() {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: layout.tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: colors.tile,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}>
      <House size={26} color={colors.rose} strokeWidth={2} />
      <Search size={26} color={colors.tabInactive} strokeWidth={2} />
      <CircleUserRound size={26} color={colors.tabInactive} strokeWidth={2} />
    </View>
  );
}
