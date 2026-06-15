import { Circle, Path, Rect, Svg, Text as SvgText } from "react-native-svg"

type MoneyAgentLogoProps = {
  width?: number
  height?: number
  opacity?: number
}

export function MoneyAgentLogo({ width = 40, height = 44, opacity = 1 }: MoneyAgentLogoProps) {
  return (
    <Svg
      accessibilityLabel="Money Agent"
      height={height}
      opacity={opacity}
      role="img"
      viewBox="0 0 200 220"
      width={width}
    >
      <Path
        d="M 0 22 Q 0 0 22 0 L 178 0 Q 200 0 200 22 L 200 148 Q 200 170 178 170 L 120 170 L 100 202 L 80 170 L 22 170 Q 0 170 0 148 Z"
        fill="#3d9a6e"
      />
      <Rect x={28} y={54} width={144} height={68} rx={10} fill="#2e7a57" />
      <Rect x={28} y={54} width={144} height={20} rx={10} fill="#348a60" />
      <SvgText
        x={100}
        y={104}
        fill="#ffffff"
        fontFamily="system-ui"
        fontSize={40}
        fontWeight="700"
        textAnchor="middle"
      >
        $
      </SvgText>
      <Circle cx={56} cy={148} r={6} fill="#ffffff" opacity={0.35} />
      <Circle cx={76} cy={148} r={6} fill="#ffffff" opacity={0.65} />
      <Circle cx={96} cy={148} r={6} fill="#ffffff" />
    </Svg>
  )
}
