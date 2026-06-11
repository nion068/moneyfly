import { ReactNode } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type FinanceCardProps = {
  children: ReactNode
  style?: ViewStyle
}

export function FinanceCard({ children, style }: FinanceCardProps) {
  const { themed } = useAppTheme()
  return <View style={themed([$card, style])}>{children}</View>
}

type ChipProps = {
  label: string
  active?: boolean
  onPress?: () => void
}

export function Chip({ label, active, onPress }: ChipProps) {
  const { themed } = useAppTheme()

  return (
    <Pressable onPress={onPress} style={themed([$chip, active && $activeChip])}>
      <Text text={label} style={themed([$chipText, active && $activeChipText])} />
    </Pressable>
  )
}

type MetricPillProps = {
  label: string
  value: string
  tone: "income" | "expense" | "saved"
  icon: string
  compact?: boolean
  centered?: boolean
  dense?: boolean
  singleLineValue?: boolean
}

export function MetricPill({
  label,
  value,
  tone,
  icon,
  compact = false,
  centered = false,
  dense = false,
  singleLineValue = false,
}: MetricPillProps) {
  const { themed } = useAppTheme()

  return (
    <View
      style={themed([
        $metricPill,
        compact && $compactMetricPill,
        dense && $denseMetricPill,
        centered && $centeredMetricPill,
        $metricTone[tone],
      ])}
    >
      <View style={themed([$metricIcon, dense && $denseMetricIcon, $metricIconTone[tone]])}>
        <Text text={icon} style={themed([$metricIconText, dense && $denseMetricIconText])} />
      </View>
      <Text text={label} style={themed([$mutedLabel, dense && $denseMutedLabel])} />
      <Text
        text={value}
        testID={`metric-value-${label.toLowerCase()}`}
        numberOfLines={singleLineValue ? 1 : undefined}
        adjustsFontSizeToFit={singleLineValue}
        minimumFontScale={singleLineValue ? 0.65 : undefined}
        style={themed([
          $metricValue,
          compact && $compactMetricValue,
          dense && $denseMetricValue,
          singleLineValue && $singleLineMetricValue,
          $metricValueTone[tone],
        ])}
      />
    </View>
  )
}

type SectionHeaderProps = {
  title: string
  action?: string
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($sectionHeader)}>
      <Text text={title} style={themed($sectionTitle)} />
      {!!action && <Text text={action} style={themed($sectionAction)} />}
    </View>
  )
}

type ProgressBarProps = {
  value: number
  color?: string
}

export function ProgressBar({ value, color }: ProgressBarProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <View style={themed($progressTrack)}>
      <View
        style={[
          themed($progressFill),
          { width: `${Math.max(4, Math.min(100, value))}%`, backgroundColor: color ?? colors.tint },
        ]}
      />
    </View>
  )
}

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 28,
  borderWidth: 1,
  padding: spacing.lg,
})

const $chip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderColor: colors.palette.stroke,
  borderRadius: 999,
  borderWidth: 1,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
})

const $activeChip: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
})

const $chipText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 14,
  lineHeight: 18,
})

const $activeChipText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
})

const $metricPill: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderRadius: 22,
  flex: 1,
  gap: spacing.xxs,
  minHeight: 92,
  padding: spacing.md,
})

const $compactMetricPill: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minHeight: 82,
  padding: spacing.sm,
})

const $denseMetricPill: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
  minHeight: 68,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $centeredMetricPill: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  justifyContent: "center",
})

const $metricTone: Record<MetricPillProps["tone"], ThemedStyle<ViewStyle>> = {
  income: () => ({ backgroundColor: "rgba(62, 165, 118, 0.22)" }),
  expense: () => ({ backgroundColor: "rgba(216, 113, 98, 0.18)" }),
  saved: () => ({ backgroundColor: "rgba(134, 205, 234, 0.17)" }),
}

const $metricIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  borderRadius: 14,
  height: 28,
  justifyContent: "center",
  width: 28,
})

const $denseMetricIcon: ThemedStyle<ViewStyle> = () => ({
  borderRadius: 11,
  height: 22,
  width: 22,
})

const $metricIconTone: Record<MetricPillProps["tone"], ThemedStyle<ViewStyle>> = {
  income: ({ colors }) => ({ backgroundColor: colors.palette.primary500 }),
  expense: ({ colors }) => ({ backgroundColor: colors.palette.tertiary300 }),
  saved: ({ colors }) => ({ backgroundColor: colors.palette.secondary300 }),
}

const $metricIconText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
  fontSize: 15,
  lineHeight: 17,
})

const $denseMetricIconText: ThemedStyle<TextStyle> = () => ({
  fontSize: 12,
  lineHeight: 14,
})

const $mutedLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
  lineHeight: 17,
})

const $denseMutedLabel: ThemedStyle<TextStyle> = () => ({
  fontSize: 12,
  lineHeight: 14,
})

const $metricValue: ThemedStyle<TextStyle> = ({ typography }) => ({
  fontFamily: typography.primary.semiBold,
  fontSize: 18,
  lineHeight: 22,
})

const $compactMetricValue: ThemedStyle<TextStyle> = () => ({
  fontSize: 16,
  lineHeight: 20,
})

const $denseMetricValue: ThemedStyle<TextStyle> = () => ({
  fontSize: 15,
  lineHeight: 18,
})

const $singleLineMetricValue: ThemedStyle<TextStyle> = () => ({
  alignSelf: "stretch",
  textAlign: "center",
  width: "100%",
})

const $metricValueTone: Record<MetricPillProps["tone"], ThemedStyle<TextStyle>> = {
  income: ({ colors }) => ({ color: colors.tint }),
  expense: ({ colors }) => ({ color: colors.palette.tertiary300 }),
  saved: ({ colors }) => ({ color: colors.palette.secondary300 }),
}

const $sectionHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 20,
  lineHeight: 26,
})

const $sectionAction: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.medium,
  fontSize: 13,
  lineHeight: 18,
})

const $progressTrack: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHighest,
  borderRadius: 999,
  height: 8,
  overflow: "hidden",
})

const $progressFill: ThemedStyle<ViewStyle> = () => ({
  borderRadius: 999,
  height: 8,
})
