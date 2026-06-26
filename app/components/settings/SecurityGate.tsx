import { PropsWithChildren, useEffect, useRef } from "react"
import { StyleSheet, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { useSecurity } from "@/context/SecurityContext"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function SecurityGate({ children }: PropsWithChildren) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    biometricEnabled,
    biometricEnrolled,
    biometricSupported,
    isAuthenticating,
    isChecking,
    isLocked,
    unlock,
    error,
  } = useSecurity()
  const attempted = useRef(false)
  const canAuthenticate = biometricSupported && biometricEnrolled

  useEffect(() => {
    if (!biometricEnabled || !isLocked || isChecking || !canAuthenticate || attempted.current) {
      return
    }
    attempted.current = true

    const timeout = setTimeout(() => {
      void unlock()
    }, 650)

    return () => clearTimeout(timeout)
  }, [biometricEnabled, canAuthenticate, isChecking, isLocked, unlock])

  useEffect(() => {
    if (!isLocked) attempted.current = false
  }, [isLocked])

  return (
    <View style={$root}>
      {children}
      {biometricEnabled && isLocked ? (
        <View style={themed($overlay)} accessibilityViewIsModal>
          <View style={themed($container)}>
            <View style={themed($icon)}>
              <MaterialCommunityIcons
                name="fingerprint"
                color={colors.palette.secondary300}
                size={68}
              />
            </View>
            <Text text="Moneyfly is locked" style={themed($title)} />
            <Text
              text={
                isChecking
                  ? "Checking device authentication..."
                  : "Use Face ID, fingerprint, or your device passcode to continue."
              }
              style={themed($body)}
            />
            {error ? <Text text={error} style={themed($error)} /> : null}
            <Button
              text={isAuthenticating ? "Unlocking..." : "Unlock"}
              disabled={isAuthenticating}
              onPress={() => void unlock()}
              style={themed($button)}
              disabledStyle={themed($buttonDisabled)}
              textStyle={themed($buttonText)}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}

const $root: ViewStyle = {
  flex: 1,
}

const $overlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  ...StyleSheet.absoluteFillObject,
  backgroundColor: colors.background,
  elevation: 12,
  zIndex: 1,
})

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flex: 1,
  gap: spacing.md,
  justifyContent: "center",
  padding: spacing.xl,
})

const $icon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "rgba(40, 90, 116, 0.42)",
  borderRadius: 56,
  height: 112,
  justifyContent: "center",
  width: 112,
})

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 30,
  lineHeight: 38,
  paddingBottom: 2,
  textAlign: "center",
})

const $body: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 17,
  lineHeight: 25,
  textAlign: "center",
})

const $error: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  textAlign: "center",
})

const $button: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
  minWidth: 180,
})

const $buttonDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.72,
})

const $buttonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.background,
  fontFamily: typography.primary.bold,
})
