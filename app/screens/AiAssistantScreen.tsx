import { FC } from "react"
import { TextStyle, View, ViewStyle } from "react-native"

import { FinanceCard } from "@/components/firefly/FinancePrimitives"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type AiAssistantScreenProps = MainTabScreenProps<"AiAssistant">

export const AiAssistantScreen: FC<AiAssistantScreenProps> = () => {
  const { themed } = useAppTheme()

  return (
    <Screen preset="auto" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($avatar)}>
        <Text text="✦" style={themed($glyph)} />
      </View>
      <Text text="AI Assistant" style={themed($title)} />
      <FinanceCard>
        <Text text="Gemini integration coming later" style={themed($cardTitle)} />
        <Text
          text="Transaction drafting is disabled until Gemini parsing and confirmation are implemented."
          style={themed($body)}
        />
      </FinanceCard>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.lg,
  justifyContent: "center",
  padding: spacing.lg,
})

const $avatar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 40,
  height: 80,
  justifyContent: "center",
  width: 80,
})

const $glyph: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 36,
})

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 32,
})

const $cardTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 20,
  textAlign: "center",
})

const $body: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  lineHeight: 22,
  marginTop: spacing.sm,
  textAlign: "center",
})
