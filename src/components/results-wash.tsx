import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

const PEACH = '#E8B487'; // warm apricot-tan
const SLATE = '#6C88B4'; // muted slate blue

// Irregular blobs and tapered brushstroke ribbons — tips converge to points so
// they read as loaded-brush strokes, not blunt geometry.
const BLOB_A =
  'M-40 26 C10 -6 96 -18 156 16 C196 40 210 86 192 128 C176 166 128 196 78 192 C22 188 -18 156 -40 118 Z';
const RIBBON_C =
  'M302 218 C332 246 354 284 368 326 C378 356 392 398 406 430 C400 392 392 352 380 314 C366 272 338 240 302 218 Z';
const DAB_C =
  'M356 258 C376 274 390 300 400 330 C404 344 408 358 412 368 C410 342 404 314 394 290 C384 272 370 262 356 258 Z';
const STROKE_F =
  'M244 846 C288 810 332 782 372 764 C390 756 404 752 412 754 C398 770 372 788 338 808 C306 826 272 840 244 846 Z';
const SWEEP_G =
  'M-30 710 C28 740 86 778 136 816 C156 832 168 848 174 868 C146 858 112 840 74 814 C32 786 -8 754 -30 710 Z';
const DAB_G =
  'M-16 762 C24 784 62 808 94 832 C104 840 110 848 108 854 C82 846 50 830 22 810 C4 796 -10 780 -16 762 Z';

/**
 * Static full-bleed watercolor wash for the results screen — recreates the
 * handoff mockup background natively: layered translucent peach + slate shapes
 * that pool like brushed pigment (the category-art PastelDisc technique at page
 * scale). No gradients or filters; softness comes from stacked low-opacity fills.
 */
export function ResultsWash() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        {/* A — top-left peach field */}
        <Ellipse cx={64} cy={98} rx={150} ry={118} fill={PEACH} opacity={0.3} />
        <Ellipse cx={96} cy={142} rx={118} ry={88} fill={PEACH} opacity={0.22} />
        <Path d={BLOB_A} fill={PEACH} opacity={0.22} />

        {/* B — top-right peach field */}
        <Ellipse cx={340} cy={84} rx={128} ry={104} fill={PEACH} opacity={0.3} />
        <Ellipse cx={312} cy={132} rx={96} ry={72} fill={PEACH} opacity={0.2} />
        <Ellipse cx={396} cy={232} rx={64} ry={88} fill={PEACH} opacity={0.2} />

        {/* C — right-edge slate brushstrokes */}
        <G transform="translate(-16,-12)" opacity={0.3}>
          <Path d={RIBBON_C} fill={SLATE} />
        </G>
        <Path d={RIBBON_C} fill={SLATE} opacity={0.45} />
        <G transform="translate(7,9)" opacity={0.3}>
          <Path d={RIBBON_C} fill={SLATE} />
        </G>
        <Path d={DAB_C} fill={SLATE} opacity={0.35} />

        {/* D — mid-left peach wisp */}
        <Ellipse cx={-16} cy={560} rx={112} ry={66} fill={PEACH} opacity={0.26} />
        <Ellipse cx={14} cy={586} rx={86} ry={50} fill={PEACH} opacity={0.22} />

        {/* E — right-mid faint peach edge */}
        <Ellipse cx={400} cy={600} rx={72} ry={88} fill={PEACH} opacity={0.18} />

        {/* F — bottom-right peach strokes */}
        <Ellipse cx={354} cy={756} rx={104} ry={62} fill={PEACH} opacity={0.26} />
        <Ellipse cx={390} cy={802} rx={96} ry={58} fill={PEACH} opacity={0.24} />
        <Path d={STROKE_F} fill={PEACH} opacity={0.4} />
        <G transform="translate(10,14)" opacity={0.26}>
          <Path d={STROKE_F} fill={PEACH} />
        </G>

        {/* G — bottom-left slate sweep, painted last */}
        <Path d={SWEEP_G} fill={SLATE} opacity={0.45} />
        <G transform="translate(12,14)" opacity={0.32}>
          <Path d={SWEEP_G} fill={SLATE} />
        </G>
        <Path d={DAB_G} fill={SLATE} opacity={0.28} />
      </Svg>
    </View>
  );
}
