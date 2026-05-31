import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

interface Props {
  size?: number;
}

export default function TradeFlowEmblem({ size = 44 }: Props) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.46;

  // Sprocket tooth count and sizing
  const teeth = 12;
  const innerR = r * 0.52;
  const outerR = r * 0.68;
  const toothW = (Math.PI * 2 * innerR) / teeth / 2.6;

  // Build sprocket path (circle with rectangular teeth)
  const sprocketPath = () => {
    const parts: string[] = [];
    for (let i = 0; i < teeth; i++) {
      const angle = (i / teeth) * Math.PI * 2 - Math.PI / 2;
      const nextAngle = ((i + 0.5) / teeth) * Math.PI * 2 - Math.PI / 2;
      const halfTooth = toothW / 2 / outerR;

      const a1 = angle - halfTooth;
      const a2 = angle + halfTooth;
      const a3 = nextAngle - halfTooth;

      parts.push(
        `M ${cx + Math.cos(a1) * innerR} ${cy + Math.sin(a1) * innerR}`,
        `L ${cx + Math.cos(a1) * outerR} ${cy + Math.sin(a1) * outerR}`,
        `A ${outerR} ${outerR} 0 0 1 ${cx + Math.cos(a2) * outerR} ${cy + Math.sin(a2) * outerR}`,
        `L ${cx + Math.cos(a2) * innerR} ${cy + Math.sin(a2) * innerR}`,
        `A ${innerR} ${innerR} 0 0 1 ${cx + Math.cos(a3) * innerR} ${cy + Math.sin(a3) * innerR}`,
      );
    }
    return parts.join(' ') + ' Z';
  };

  // Clock hour hand angles (12 and ~4 o'clock positions, visible past spanner)
  const hand12x2 = cx + Math.cos(-Math.PI / 2) * innerR * 0.62;
  const hand12y2 = cy + Math.sin(-Math.PI / 2) * innerR * 0.62;
  const hand4x2 = cx + Math.cos(Math.PI / 3) * innerR * 0.5;
  const hand4y2 = cy + Math.sin(Math.PI / 3) * innerR * 0.5;

  const handW = s * 0.025;

  // Spanner: angled ~135deg, covering left side
  const spanW = s * 0.085;
  const spanL = r * 1.05;
  const spanAngle = -45;

  // Font sizes relative to emblem size
  const brandSize = s * 0.18;
  const tagSize = s * 0.095;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        {/* Navy circle background */}
        <RadialGradient id="navyBg" cx="45%" cy="38%" r="60%">
          <Stop offset="0%" stopColor="#1a3a6b" />
          <Stop offset="100%" stopColor="#0a1f3f" />
        </RadialGradient>

        {/* Silver gradient for 3D effect */}
        <LinearGradient id="silver3d" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#e8ecf0" />
          <Stop offset="30%" stopColor="#c8d0d8" />
          <Stop offset="60%" stopColor="#9daab8" />
          <Stop offset="100%" stopColor="#6b7f94" />
        </LinearGradient>

        <LinearGradient id="silverShine" x1="0%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0%" stopColor="#f0f4f8" />
          <Stop offset="40%" stopColor="#b8c4d0" />
          <Stop offset="100%" stopColor="#7890a4" />
        </LinearGradient>

        <LinearGradient id="circleRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#dde4eb" />
          <Stop offset="50%" stopColor="#a0b0c0" />
          <Stop offset="100%" stopColor="#607080" />
        </LinearGradient>
      </Defs>

      {/* Outer silver rim */}
      <Circle cx={cx} cy={cy} r={r + s * 0.025} fill="url(#circleRim)" />
      {/* Navy background circle */}
      <Circle cx={cx} cy={cy} r={r} fill="url(#navyBg)" />

      {/* Sprocket teeth */}
      <Path d={sprocketPath()} fill="url(#silver3d)" />

      {/* Sprocket inner hub ring */}
      <Circle cx={cx} cy={cy} r={innerR * 0.95} fill="url(#navyBg)" />
      <Circle cx={cx} cy={cy} r={innerR * 0.9} fill="none" stroke="url(#silver3d)" strokeWidth={s * 0.018} />

      {/* Center boss */}
      <Circle cx={cx} cy={cy} r={innerR * 0.18} fill="url(#silver3d)" />

      {/* Clock hour hand - 12 o'clock (visible above spanner) */}
      <Line
        x1={cx}
        y1={cy}
        x2={hand12x2}
        y2={hand12y2}
        stroke="url(#silverShine)"
        strokeWidth={handW}
        strokeLinecap="round"
      />
      {/* Clock hour hand - ~4 o'clock (visible right of spanner) */}
      <Line
        x1={cx}
        y1={cy}
        x2={hand4x2}
        y2={hand4y2}
        stroke="url(#silverShine)"
        strokeWidth={handW}
        strokeLinecap="round"
      />

      {/* Spanner overlaying left side */}
      <G
        transform={`translate(${cx}, ${cy}) rotate(${spanAngle})`}
        origin={`${cx}, ${cy}`}
      >
        {/* Spanner shaft */}
        <Path
          d={`M ${-spanL * 0.55} ${-spanW * 0.35}
              L ${spanL * 0.45} ${-spanW * 0.35}
              L ${spanL * 0.45} ${spanW * 0.35}
              L ${-spanL * 0.55} ${spanW * 0.35} Z`}
          fill="url(#silver3d)"
        />
        {/* Spanner head left (open-end) - C shape top */}
        <Path
          d={`M ${-spanL * 0.55} ${-spanW * 1.1}
              A ${spanW * 0.9} ${spanW * 0.9} 0 0 0 ${-spanL * 0.55} ${spanW * 1.1}
              L ${-spanL * 0.3} ${spanW * 1.1}
              A ${spanW * 0.6} ${spanW * 0.6} 0 0 1 ${-spanL * 0.3} ${-spanW * 1.1} Z`}
          fill="url(#silver3d)"
        />
        {/* Spanner head right (ring end) */}
        <Circle cx={spanL * 0.45} cy={0} r={spanW * 0.85} fill="url(#silver3d)" />
        <Circle cx={spanL * 0.45} cy={0} r={spanW * 0.42} fill="url(#navyBg)" />
      </G>

      {/* TRADEFLOW text */}
      <SvgText
        x={cx}
        y={cy + r * 0.52}
        textAnchor="middle"
        fontSize={brandSize}
        fontWeight="bold"
        fill="url(#silverShine)"
        letterSpacing={s * 0.012}
      >
        TRADEFLOW
      </SvgText>

      {/* job time management text */}
      <SvgText
        x={cx}
        y={cy + r * 0.72}
        textAnchor="middle"
        fontSize={tagSize}
        fill="#9fb8cc"
        letterSpacing={s * 0.004}
      >
        job time management
      </SvgText>
    </Svg>
  );
}
