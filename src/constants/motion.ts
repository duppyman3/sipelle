import { Easing, FadeInDown, LinearTransition } from 'react-native-reanimated';

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

export const pressTiming = { duration: 120, easing: softEasing };

// The layout glide behind the results footer: a 260ms soft-eased position
// transition (module scope, per the rationale above).
export const expandTransition = LinearTransition.duration(260).easing(softEasing);
