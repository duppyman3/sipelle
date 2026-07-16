import { Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterSoft } from '@/constants/motion';
import { colors, fonts, shadows } from '@/constants/theme';

// When the backend can't reach the AI service, the home screen swaps its
// category chips for this single tile. It borrows the scan-cap card idiom —
// white tile, Caveat title, soft rise — so an outage still feels like the app,
// not an error page. The `message` carries whatever the backend chose to say;
// an empty string renders the title alone.

export function SystemDownCard({ message }: { message: string }) {
  return (
    <Animated.View
      entering={enterSoft}
      style={{
        marginTop: 28,
        backgroundColor: colors.tile,
        borderRadius: 28,
        borderCurve: 'continuous',
        padding: 24,
        alignItems: 'center',
        boxShadow: shadows.card,
      }}>
      {/* stretch + textAlign center guard the RN-Android last-word clip on
          intrinsic-width custom-font text; the entering re-layout re-breaks it. */}
      <Text
        style={{
          fontFamily: fonts.hand,
          fontSize: 32,
          lineHeight: 36,
          color: colors.ink,
          alignSelf: 'stretch',
          textAlign: 'center',
        }}>
        System Down
      </Text>
      {message.length > 0 ? (
        <Text
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: colors.body,
            marginTop: 8,
            textAlign: 'center',
          }}>
          {message}
        </Text>
      ) : null}
    </Animated.View>
  );
}
