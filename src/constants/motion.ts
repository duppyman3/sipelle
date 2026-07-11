import { Easing, FadeInDown, FadeOut } from 'react-native-reanimated';

// Builders live at module scope so React Compiler memoization never
// recreates them per render.
export const softEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

// The handoff specifies one entrance: fade + 14px rise (FadeInDown's default
// offset is 25px, so the initial values are overridden). The explicit tuple
// type matches the builder's TransformsConfig constraint.
const riseBy14: { opacity: number; transform: [{ translateY: number }] } = {
  opacity: 0,
  transform: [{ translateY: 14 }],
};

export const enterSoft = FadeInDown.duration(500).easing(softEasing).withInitialValues(riseBy14);

export const enterSplashCaption = FadeInDown.duration(900)
  .easing(softEasing)
  .withInitialValues(riseBy14);

export const toastEnter = FadeInDown.duration(200).easing(softEasing).withInitialValues(riseBy14);

export const toastExit = FadeOut.duration(150);

export const pressTiming = { duration: 120, easing: softEasing };
