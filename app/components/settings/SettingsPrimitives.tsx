import { ComponentProps, ReactNode, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export type SettingsIconName = ComponentProps<typeof MaterialCommunityIcons>["name"]
export type SettingsTone = "primary" | "blue" | "neutral" | "danger"

export function SettingsHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  action?: ReactNode
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <View style={themed($header)}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={onBack}
          style={themed($backButton)}
        >
          <MaterialCommunityIcons name="chevron-left" color={colors.text} size={30} />
        </Pressable>
      ) : null}
      <View style={themed($headerCopy)}>
        <Text text={title} style={themed($title)} />
        {subtitle ? <StatusText text={subtitle} /> : null}
      </View>
      {action ? <View style={themed($headerAction)}>{action}</View> : null}
    </View>
  )
}

export function StatusText({ text, positive = true }: { text: string; positive?: boolean }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($status)}>
      <View style={themed(positive ? $positiveDot : $neutralDot)} />
      <Text text={text} style={themed(positive ? $positiveText : $muted)} />
    </View>
  )
}

export function SettingsIcon({
  name,
  tone = "neutral",
  size = 24,
}: {
  name: SettingsIconName
  tone?: SettingsTone
  size?: number
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const color =
    tone === "primary"
      ? colors.tint
      : tone === "blue"
        ? colors.palette.secondary300
        : tone === "danger"
          ? colors.palette.tertiary300
          : colors.textDim

  return (
    <View style={themed([$icon, $iconTone[tone]])}>
      <MaterialCommunityIcons name={name} color={color} size={size} />
    </View>
  )
}

export function SettingsCard({
  children,
  onPress,
  disabled,
  accessibilityLabel,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  accessibilityLabel?: string
  style?: ViewStyle
}) {
  const { themed } = useAppTheme()
  const content = <View style={themed([$card, disabled && $disabled, style])}>{children}</View>

  if (!onPress) return content

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {content}
    </Pressable>
  )
}

export function SettingsSummaryCard({
  title,
  subtitle,
  status,
  icon,
  tone,
  onPress,
  disabled,
}: {
  title: string
  subtitle: string
  status?: boolean
  icon: SettingsIconName
  tone: SettingsTone
  onPress?: () => void
  disabled?: boolean
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <SettingsCard
      accessibilityLabel={`${title}. ${disabled ? "Unavailable" : subtitle}`}
      disabled={disabled}
      onPress={onPress}
      style={themed($summaryCard)}
    >
      <View style={themed($summaryIcon)}>
        <SettingsIcon name={icon} tone={tone} size={21} />
      </View>
      <View style={themed($summaryCopy)}>
        <Text text={title} style={themed($cardTitle)} />
        <View style={themed($status)}>
          {status !== undefined ? (
            <View style={themed(status ? $positiveDot : $neutralDot)} />
          ) : null}
          <Text text={subtitle} numberOfLines={2} style={themed($muted)} />
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" color={colors.textDim} size={28} />
    </SettingsCard>
  )
}

export function SettingsSection({
  title,
  children,
  collapsible = false,
  initiallyExpanded = true,
  headerAction,
}: {
  title: string
  children: ReactNode
  collapsible?: boolean
  initiallyExpanded?: boolean
  headerAction?: ReactNode
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  return (
    <SettingsCard>
      <View style={themed($sectionHeader)}>
        {collapsible ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((value) => !value)}
            style={themed($sectionToggle)}
          >
            <Text text={title.toUpperCase()} style={themed($eyebrow)} />
            <MaterialCommunityIcons
              name={expanded ? "chevron-up" : "chevron-down"}
              color={colors.textDim}
              size={22}
            />
          </Pressable>
        ) : (
          <Text text={title.toUpperCase()} style={themed($eyebrow)} />
        )}
        {headerAction}
      </View>
      {expanded ? children : null}
    </SettingsCard>
  )
}

export function SettingsRow({
  title,
  subtitle,
  value,
  icon,
  tone = "neutral",
  onPress,
  disabled,
  trailing,
  first = false,
}: {
  title: string
  subtitle?: string
  value?: string
  icon: SettingsIconName
  tone?: SettingsTone
  onPress?: () => void
  disabled?: boolean
  trailing?: ReactNode
  first?: boolean
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ disabled }}
      disabled={!onPress || disabled}
      onPress={onPress}
      style={themed([$row, first && $firstRow, disabled && $disabled])}
    >
      <SettingsIcon name={icon} tone={tone} size={22} />
      <View style={themed($rowCopy)}>
        <Text text={title} style={themed($rowTitle)} />
        {subtitle ? <Text text={subtitle} style={themed($muted)} /> : null}
      </View>
      {value ? <Text text={value} numberOfLines={1} style={themed($value)} /> : null}
      {trailing}
      {onPress && !trailing ? (
        <MaterialCommunityIcons name="chevron-right" color={colors.textDim} size={26} />
      ) : null}
    </Pressable>
  )
}

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.md,
  minHeight: 64,
})
const $headerCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $headerAction: ThemedStyle<ViewStyle> = () => ({ marginLeft: "auto" })
const $backButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  borderColor: colors.palette.stroke,
  borderRadius: 28,
  borderWidth: 1,
  height: 56,
  justifyContent: "center",
  width: 56,
})
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 36,
  lineHeight: 42,
})
const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 28,
  borderWidth: 1,
  overflow: "hidden",
  padding: spacing.lg,
})
const $summaryCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 88,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
})
const $summaryIcon: ThemedStyle<ViewStyle> = () => ({
  transform: [{ scale: 0.82 }],
})
const $summaryCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $cardTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 20,
  lineHeight: 26,
})
const $icon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  borderRadius: 28,
  height: 56,
  justifyContent: "center",
  width: 56,
})
const $iconTone: Record<SettingsTone, ThemedStyle<ViewStyle>> = {
  primary: () => ({ backgroundColor: "rgba(62, 165, 118, 0.18)" }),
  blue: () => ({ backgroundColor: "rgba(40, 90, 116, 0.28)" }),
  neutral: () => ({ backgroundColor: "rgba(131, 125, 117, 0.16)" }),
  danger: () => ({ backgroundColor: "rgba(128, 55, 44, 0.28)" }),
}
const $status: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
  marginTop: spacing.xxxs,
})
const $positiveDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderRadius: 5,
  height: 10,
  width: 10,
})
const $neutralDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.textDim,
  borderRadius: 5,
  height: 10,
  width: 10,
})
const $positiveText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 15,
  lineHeight: 21,
})
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 15,
  lineHeight: 21,
})
const $sectionHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})
const $sectionToggle: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flex: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  marginHorizontal: -4,
  paddingHorizontal: 4,
  paddingVertical: 2,
})
const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.semiBold,
  fontSize: 14,
  letterSpacing: 2.4,
  lineHeight: 20,
})
const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  flexDirection: "row",
  gap: spacing.md,
  minHeight: 88,
  paddingTop: spacing.md,
  paddingVertical: spacing.md,
})
const $firstRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderTopWidth: 0,
  marginTop: spacing.sm,
})
const $rowCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $rowTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 18,
  lineHeight: 24,
})
const $value: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flexShrink: 1,
  fontSize: 16,
  maxWidth: "38%",
  textAlign: "right",
})
const $disabled: ThemedStyle<ViewStyle> = () => ({ opacity: 0.45 })
