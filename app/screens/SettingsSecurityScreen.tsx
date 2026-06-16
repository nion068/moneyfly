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
import { Switch, SwitchToggleProps } from "@/components/Toggle/Switch"
import { useSecurity } from "@/context/SecurityContext"
import type { SettingsStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Props = SettingsStackScreenProps<"SettingsSecurity">
type SwitchDetailStyle = NonNullable<SwitchToggleProps["inputDetailStyle"]>

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
        : biometricSupported
          ? "Biometric not enrolled"
          : "Biometric unavailable"

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <SettingsHeader title="Security" subtitle={status} onBack={navigation.goBack} />

      <View style={themed($hero)}>
        <View style={themed($heroIcon)}>
          <MaterialCommunityIcons
            name="fingerprint"
            color={colors.palette.secondary300}
            size={54}
          />
        </View>
        <Text text="Biometric Authentication" style={themed($title)} />
        <Text
          text="Use Face ID, fingerprint, or your device passcode to unlock Moneyfly after it leaves the foreground."
          style={themed($body)}
        />
      </View>

      <SettingsCard>
        <SettingsRow
          first
          title="Biometric Unlock"
          subtitle={
            available
              ? "Face ID / Fingerprint with device passcode fallback"
              : biometricSupported
                ? "Enroll biometrics or device authentication in system settings"
                : "Requires supported hardware"
          }
          icon="fingerprint"
          tone="blue"
          disabled={isChecking || !available}
          trailing={
            <Switch
              value={biometricEnabled}
              disabled={isChecking || !available}
              onValueChange={(value) => void setBiometricEnabled(value)}
              inputOuterStyle={themed($switchOuter)}
              inputInnerStyle={themed($switchInner)}
              inputDetailStyle={themed($switchKnob)}
            />
          }
        />
      </SettingsCard>

      {error ? <Text text={error} style={themed($error)} /> : null}

      <SettingsCard style={themed($notice)}>
        <SettingsIcon name="information-outline" />
        <Text
          text={
            biometricEnabled
              ? "Moneyfly will lock after it leaves the foreground and ask for device authentication when reopened."
              : "Moneyfly will not request biometric authentication until you enable biometric unlock."
          }
          style={themed($noticeText)}
        />
      </SettingsCard>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: 112,
})
const $hero: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.sm,
  paddingVertical: spacing.md,
})
const $heroIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "rgba(40, 90, 116, 0.56)",
  borderRadius: 40,
  height: 80,
  justifyContent: "center",
  width: 80,
})
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 22,
  textAlign: "center",
})
const $body: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  lineHeight: 21,
  textAlign: "center",
})
const $error: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  textAlign: "center",
})
const $notice: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-start",
  flexDirection: "row",
  gap: spacing.sm,
})
const $noticeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  fontSize: 13,
  lineHeight: 19,
})
const $switchOuter: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHighest,
  borderColor: colors.palette.stroke,
  borderWidth: 1,
})
const $switchInner: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
})
const $switchKnob: ThemedStyle<SwitchDetailStyle> = ({ colors }) => ({
  backgroundColor: colors.background,
  shadowColor: colors.palette.overlay80,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.28,
  shadowRadius: 4,
})
