import { FC, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
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
import {
  BIOMETRIC_LOCK_DELAY_OPTIONS,
  getBiometricLockDelayLabel,
  getBiometricLockDelaySummary,
  useSecurity,
} from "@/context/SecurityContext"
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
    biometricLockDelaySeconds,
    biometricSupported,
    biometricEnrolled,
    isChecking,
    error,
    setBiometricEnabled,
    setBiometricLockDelaySeconds,
  } = useSecurity()
  const available = biometricSupported && biometricEnrolled
  const lockDelayValue = getBiometricLockDelayLabel(biometricLockDelaySeconds)
  const [lockDelayExpanded, setLockDelayExpanded] = useState(true)
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
          text="Use Face ID, fingerprint, or your device passcode to unlock Moneyfly after the delay you choose."
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
              accessibilityLabel="Biometric Unlock"
              inputOuterStyle={themed($switchOuter)}
              inputInnerStyle={themed($switchInner)}
              inputDetailStyle={themed($switchKnob)}
            />
          }
        />
      </SettingsCard>

      <SettingsCard>
        <Pressable
          accessibilityLabel="Lock Delay"
          accessibilityRole="button"
          accessibilityState={{ expanded: lockDelayExpanded }}
          onPress={() => setLockDelayExpanded((value) => !value)}
          style={themed($delayHeader)}
        >
          <View style={themed($delayHeaderTop)}>
            <SettingsIcon name="timer-lock-outline" tone="blue" size={22} />
            <View style={themed($delayHeaderCopy)}>
              <Text text="Lock Delay" style={themed($delayTitle)} />
              <Text
                text={lockDelayExpanded ? "Choose when Moneyfly locks." : lockDelayValue}
                style={themed([$delaySubtitle, !lockDelayExpanded && $delaySubtitleCollapsed])}
              />
            </View>
            <View style={themed($delayChevron)}>
              <MaterialCommunityIcons
                name={lockDelayExpanded ? "chevron-up" : "chevron-down"}
                color={colors.textDim}
                size={18}
              />
            </View>
          </View>
        </Pressable>
        {lockDelayExpanded ? <View style={themed($delayDivider)} /> : null}
        {lockDelayExpanded ? (
          <View style={themed($delayOptions)}>
            {BIOMETRIC_LOCK_DELAY_OPTIONS.map((delay) => {
              const selected = biometricLockDelaySeconds === delay
              const disabled = isChecking || !available
              return (
                <Pressable
                  key={delay}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected }}
                  accessibilityLabel={getBiometricLockDelayLabel(delay)}
                  disabled={disabled}
                  onPress={() => setBiometricLockDelaySeconds(delay)}
                  style={themed([
                    $delayTile,
                    selected && $delayTileSelected,
                    disabled && $delayTileDisabled,
                ])}
              >
                  <View style={themed($delayTileCopy)}>
                    <Text
                      text={getBiometricLockDelayLabel(delay)}
                      style={themed([$delayTileTitle, selected && $delayTileTitleSelected])}
                    />
                  </View>
                  <View
                    style={themed([
                      $delayTileIndicator,
                      selected && $delayTileIndicatorSelected,
                      disabled && $delayTileIndicatorDisabled,
                    ])}
                  >
                    <MaterialCommunityIcons
                      name={selected ? "check" : "circle-outline"}
                      color={selected ? colors.tint : colors.textDim}
                      size={16}
                    />
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}
      </SettingsCard>

      {error ? <Text text={error} style={themed($error)} /> : null}

      <SettingsCard style={themed($notice)}>
        <SettingsIcon name="information-outline" />
        <Text
          text={
            biometricEnabled
              ? `Moneyfly will lock ${getBiometricLockDelaySummary(biometricLockDelaySeconds)} after it leaves the foreground and ask for device authentication when reopened.`
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
const $delayHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  borderRadius: 18,
  gap: spacing.sm,
  marginTop: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
})
const $delayHeaderTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
})
const $delayHeaderCopy: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
const $delayTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 16,
  lineHeight: 21,
})
const $delaySubtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 17,
  marginTop: 1,
})
const $delaySubtitleCollapsed: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
})
const $delayChevron: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  borderWidth: 1,
  height: 24,
  justifyContent: "center",
  width: 24,
})
const $delayDivider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.stroke,
  height: 1,
  marginTop: spacing.sm,
})
const $delayOptions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  marginTop: spacing.sm,
})
const $delayTile: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 18,
  borderWidth: 1,
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 58,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
})
const $delayTileSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHighest,
  borderColor: colors.tint,
})
const $delayTileDisabled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  opacity: 0.55,
})
const $delayTileCopy: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
const $delayTileTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 15,
  lineHeight: 20,
})
const $delayTileTitleSelected: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})
const $delayTileIndicator: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  borderWidth: 1,
  height: 24,
  justifyContent: "center",
  width: 24,
})
const $delayTileIndicatorSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "rgba(62, 165, 118, 0.14)",
  borderColor: colors.tint,
})
const $delayTileIndicatorDisabled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
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
