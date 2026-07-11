import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toastEnter, toastExit } from '@/constants/motion';
import { colors, shadows } from '@/constants/theme';

export type ToastData = { id: number; message: string };

/**
 * Transient dark pill, per the handoff. The wrapper stays mounted (and never
 * intercepts touches) so the pill's exiting animation can run; a changed
 * `id` remounts the pill, replaying the entrance for repeat taps.
 */
export function Toast({ toast }: { toast: ToastData | null }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 8,
        alignItems: 'center',
        pointerEvents: 'none',
      }}>
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={toastEnter}
          exiting={toastExit}
          style={{
            backgroundColor: colors.ink,
            borderRadius: 999,
            paddingVertical: 10,
            paddingHorizontal: 18,
            boxShadow: shadows.toast,
          }}>
          <Text style={{ fontSize: 13.5, color: colors.washCream }}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
