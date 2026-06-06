import { ActivityIndicator, TextStyle, View, ViewStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type LoadingIndicatorProps = {
  label?: string
  compact?: boolean
}

export function LoadingIndicator({ label, compact = false }: LoadingIndicatorProps) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  return (
    <View style={themed([$container, compact && $compactContainer])}>
      <ActivityIndicator color={colors.tint} size={compact ? "small" : "large"} />
      {!!label && <Text text={label} style={themed($label)} />}
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.sm,
  justifyContent: "center",
  minHeight: 120,
})

const $compactContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  minHeight: 32,
})

const $label: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
})
