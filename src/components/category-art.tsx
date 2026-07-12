import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

import { colors } from '@/constants/theme';

export type CategoryArtKind = 'cocktails' | 'wine' | 'shots';

const INK = colors.ink;
const STROKE = 2.2;

/**
 * Vector stand-ins for the raster watercolor chips: a layered pastel disc
 * (irregular edges approximate the watercolor blob) with an ink line
 * illustration, palette-matched to the handoff washes.
 */
export function CategoryArt({ kind, size = 92 }: { kind: CategoryArtKind; size?: number }) {
  if (kind === 'cocktails') return <CocktailsArt size={size} />;
  if (kind === 'wine') return <WineArt size={size} />;
  return <ShotsArt size={size} />;
}

function PastelDisc({ fill }: { fill: string }) {
  return (
    <G>
      <Ellipse cx={46} cy={46} rx={42} ry={40.5} fill={fill} opacity={0.6} />
      <Ellipse cx={44.5} cy={47} rx={40.5} ry={42} fill={fill} opacity={0.55} />
      <Ellipse cx={47.5} cy={45} rx={41.5} ry={41} fill={fill} opacity={0.6} />
    </G>
  );
}

function CocktailsArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 92 92">
      <PastelDisc fill="#DCE6F2" />
      {/* liquid */}
      <Path d="M31.5 32 L60.5 32 L46 47.5 Z" fill={colors.rose} opacity={0.8} />
      {/* martini bowl */}
      <Path
        d="M25 28 L67 28 L46 52 Z"
        fill="none"
        stroke={INK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      {/* stem + foot */}
      <Line x1={46} y1={52} x2={46} y2={66.5} stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={35} y1={68.5} x2={57} y2={68.5} stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
      {/* lime wheel on the rim */}
      <Circle cx={62} cy={25.5} r={6} fill="#D8EFE4" stroke={INK} strokeWidth={2} />
      <Line x1={62} y1={20.5} x2={62} y2={30.5} stroke={INK} strokeWidth={1} />
      <Line x1={57} y1={25.5} x2={67} y2={25.5} stroke={INK} strokeWidth={1} />
    </Svg>
  );
}

function WineArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 92 92">
      <PastelDisc fill="#F9E4E6" />
      {/* wine in the bowl */}
      <Path
        d="M34.3 29.5 C35 40.5 39 45 46 45 C53 45 57 40.5 57.7 29.5 C52.5 32.2 39.5 32.2 34.3 29.5 Z"
        fill="#D98795"
        opacity={0.9}
      />
      <Ellipse cx={46} cy={29.7} rx={11.7} ry={2.6} fill={colors.rose} opacity={0.9} />
      {/* bowl */}
      <Path
        d="M32.5 21.5 C32.5 37.5 36.5 46.5 46 46.5 C55.5 46.5 59.5 37.5 59.5 21.5"
        fill="none"
        stroke={INK}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Ellipse cx={46} cy={21.5} rx={13.5} ry={3} fill="none" stroke={INK} strokeWidth={1.6} />
      {/* stem + foot */}
      <Line x1={46} y1={46.5} x2={46} y2={64.5} stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={35.5} y1={66.5} x2={56.5} y2={66.5} stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

function ShotsArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 92 92">
      <PastelDisc fill={colors.washMint} />
      {/* amber pour */}
      <Path
        d="M36.3 35 L39 57 C41.2 58.6 50.8 58.6 53 57 L55.7 35 C53 37 39 37 36.3 35 Z"
        fill="#D9A054"
        opacity={0.9}
      />
      <Ellipse cx={46} cy={35} rx={9.7} ry={2.3} fill="#EBBE73" opacity={0.9} />
      {/* tapered glass */}
      <Path
        d="M33 26 L37.5 62 C40 63.8 52 63.8 54.5 62 L59 26"
        fill="none"
        stroke={INK}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Ellipse cx={46} cy={26} rx={13} ry={2.9} fill="none" stroke={INK} strokeWidth={1.6} />
      {/* thick base */}
      <Path d="M38.6 57.2 Q46 59 53.4 57.2" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
