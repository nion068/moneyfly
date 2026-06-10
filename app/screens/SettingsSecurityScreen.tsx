import { FC } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import {
  SettingsCard,
  SettingsHeader,
  SettingsIcon,
  SettingsRow,
} from "@/components/settings/SettingsPrimitives"
import { Text } from "@/components/Text"
import { Switch } from "@/components/Toggle/Switch"
import { useSecurity } from "@/context/SecurityContext"
import type { SettingsStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Props = SettingsStackScreenProps<"SettingsSecurity">

export const SettingsSecurityScreen: FC<Props> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    biometricEnabled,
    biometricSupported,
    biometricEnrolled,
    isChecking,
    error,
    setBiometricEnabled,
  } = useSecurity()
  const available = biometricSupported && biometricEnrolled
  const status = isChecking
    ? "Checking device"
    : biometricEnabled
      ? "Biometric enabled"
      : available
        ? "Biometric available"
        : "Biometric unavailable"

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <SettingsHeader title="Security" subtitle={status} onBack={navigation.goBack} />

      <View style={themed($hero)}>
        <View style={themed($heroIcon)}>
          <MaterialCommunityIcons
            name="fingerprint"
            color={colors.palette.secondary300}
            size={76}
          />
        </View>
        <Text text="Biometric Authentication" style={themed($title)} />
        <Text
          text="Use Face ID or fingerprint to unlock Moneyfly after it leaves the foreground."
          style={themed($body)}
        />
      </View>

      <SettingsCard>
        <SettingsRow
          first
          title="Biometric Unlock"
          subtitle={
            available
              ? "Face ID / Fingerprint"
              : "Requires supported hardware and an enrolled biometric"
          }
          icon="fingerprint"
          tone="blue"
          disabled={isChecking || !available}
          trailing={
            <Switch
              value={biometricEnabled}
              disabled={isChecking || !available}
              onValueChange={(value) => void setBiometricEnabled(value)}
            />
          }
        />
      </SettingsCard>

      {error ? <Text text={error} style={themed($error)} /> : null}

      <SettingsCard style={themed($notice)}>
        <SettingsIcon name="information-outline" />
        <Text
          text="Authentication is performed by your device. Moneyfly never receives or stores biometric data."
          style={themed($noticeText)}
        />
      </SettingsCard>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xl,
  padding: spacing.lg,
  paddingBottom: spacing.xxxl,
})
const $hero: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.md,
  paddingVertical: spacing.xl,
})
const $heroIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "rgba(40, 90, 116, 0.56)",
  borderRadius: 56,
  height: 112,
  justifyContent: "center",
  width: 112,
})
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 28,
  textAlign: "center",
})
const $body: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 17,
  lineHeight: 26,
  textAlign: "center",
})
const $error: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  textAlign: "center",
})
const $notice: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-start",
  flexDirection: "row",
  gap: spacing.md,
})
const $noticeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  fontSize: 15,
  lineHeight: 23,
})
