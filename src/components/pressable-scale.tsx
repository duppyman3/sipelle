import { Pressable, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { type AnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { pressTiming } from '@/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Pressable's function-style `style` prop can't merge with an animated style,
// so it is narrowed to a plain view style.
type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  layout?: AnimatedProps<ViewProps>['layout'];
};

/**
 * The handoff's single press affordance: scale to 0.97 over 120ms with the
 * soft bezier, no color shift.
 */
export function PressableScale({ style, onPressIn, onPressOut, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      {...props}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scale.set(withTiming(0.97, pressTiming));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, pressTiming));
        onPressOut?.(event);
      }}
    />
  );
}
