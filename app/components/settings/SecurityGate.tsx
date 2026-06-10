import { PropsWithChildren, useEffect, useRef } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
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
  const { biometricEnabled, isLocked, unlock, error } = useSecurity()
  const attempted = useRef(false)

  useEffect(() => {
    if (!biometricEnabled || !isLocked || attempted.current) return
    attempted.current = true
    void unlock()
  }, [biometricEnabled, isLocked, unlock])

  useEffect(() => {
    if (!isLocked) attempted.current = false
  }, [isLocked])

  if (!biometricEnabled || !isLocked) return children

  return (
    <View style={themed($container)}>
      <View style={themed($icon)}>
        <MaterialCommunityIcons name="fingerprint" color={colors.palette.secondary300} size={68} />
      </View>
      <Text text="Moneyfly is locked" style={themed($title)} />
      <Text text="Authenticate with your device biometrics to continue." style={themed($body)} />
      {error ? <Text text={error} style={themed($error)} /> : null}
      <Button text="Unlock" preset="filled" onPress={() => void unlock()} style={themed($button)} />
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.background,
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
const $button: ThemedStyle<ViewStyle> = () => ({ minWidth: 180 })
