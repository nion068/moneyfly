import { FC, useState } from "react"
import { ActivityIndicator, TextStyle, View, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { FinanceCard } from "@/components/firefly/FinancePrimitives"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type SetupScreenProps = AppStackScreenProps<"Setup">

export const SetupScreen: FC<SetupScreenProps> = () => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { connectionError, isTestingConnection, setConnection } = useFirefly()
  const [baseUrl, setBaseUrl] = useState("")
  const [token, setToken] = useState("")
  const [localError, setLocalError] = useState("")

  const canSubmit = baseUrl.trim().length > 0 && token.trim().length > 0

  async function connect() {
    if (!canSubmit) {
      setLocalError("Base URL and personal access token are required.")
      return
    }

    setLocalError("")
    await setConnection(baseUrl, token)
  }

  return (
    <Screen
      preset="auto"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($container)}
    >
      <View style={themed($hero)}>
        <Text text="Moneyfly" style={themed($brand)} />
        <Text
          text="A focused mobile client for your self-hosted Firefly III."
          style={themed($subtitle)}
        />
      </View>

      <FinanceCard>
        <Text text="Connect Firefly" style={themed($cardTitle)} />
        <Text
          text="Enter your Firefly III base URL and personal access token. The app will verify /api/v1/about/user before saving."
          style={themed($body)}
        />

        <TextField
          value={baseUrl}
          onChangeText={setBaseUrl}
          label="Server URL"
          placeholder="https://firefly.example.com"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={themed($field)}
        />
        <TextField
          value={token}
          onChangeText={setToken}
          label="Personal access token"
          placeholder="Paste PAT"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          containerStyle={themed($field)}
        />

        {!!(localError || connectionError) && (
          <Text text={localError || connectionError} style={themed($error)} />
        )}

        <Button
          text={isTestingConnection ? "Testing connection..." : "Connect"}
          preset="filled"
          LeftAccessory={
            isTestingConnection
              ? () => <ActivityIndicator color={colors.palette.surfaceDim} size="small" />
              : undefined
          }
          disabled={!canSubmit || isTestingConnection}
          onPress={connect}
          style={themed($primaryButton)}
          pressedStyle={themed($primaryButtonPressed)}
          disabledStyle={themed($primaryButtonDisabled)}
          textStyle={themed($primaryButtonText)}
          disabledTextStyle={themed($primaryButtonTextDisabled)}
        />
      </FinanceCard>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  gap: spacing.xl,
  padding: spacing.lg,
})

const $hero: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  paddingTop: spacing.xxl,
})

const $brand: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.bold,
  fontSize: 46,
  lineHeight: 52,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 18,
  lineHeight: 26,
})

const $cardTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 26,
  lineHeight: 32,
})

const $body: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginBottom: spacing.md,
  marginTop: spacing.xs,
})

const $field: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $error: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.error,
  marginBottom: spacing.md,
})

const $primaryButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.tint,
  borderRadius: 18,
  marginTop: spacing.xs,
})

const $primaryButtonPressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary600,
})

const $primaryButtonDisabled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  opacity: 0.45,
})

const $primaryButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.semiBold,
})

const $primaryButtonTextDisabled: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
})
