import { router } from 'expo-router';
import { Camera, House } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { colors, layout } from '@/constants/theme';

/**
 * Home's bottom bar: the house is the active-screen indicator (not a
 * button); the camera is a shortcut to scanning, same destination as the
 * Scan Menu action.
 */
export function HomeTabBar() {
  const insets = useSafeAreaInsets();
  return (
    <View
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
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <House size={26} color={colors.rose} strokeWidth={2} />
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Scan Menu"
        onPress={() => router.push('/results')}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Camera size={26} color={colors.ink} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}
