import { ReactNode, useEffect, useRef } from "react"
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { KeyboardAvoidingView } from "react-native-keyboard-controller"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function SettingsEditorModal({
  visible,
  title,
  children,
  saveLabel = "Save",
  secondarySaveLabel,
  saving,
  canSave,
  focusOnChangeKey,
  onClose,
  onSave,
  onSecondarySave,
}: {
  visible: boolean
  title: string
  children: ReactNode
  saveLabel?: string
  secondarySaveLabel?: string
  saving?: boolean
  canSave: boolean
  focusOnChangeKey?: string | number | boolean | null
  onClose: () => void
  onSave: () => void
  onSecondarySave?: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!visible || !focusOnChangeKey) return
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0)
    return () => clearTimeout(id)
  }, [focusOnChangeKey, visible])

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={themed($keyboardView)}>
        <View style={themed($overlay)}>
          <View style={themed($sheet)}>
            <View style={themed($header)}>
              <Text text={title} style={themed($title)} />
              <Pressable accessibilityLabel="Close" onPress={onClose} style={themed($close)}>
                <MaterialCommunityIcons name="close" color={colors.text} size={24} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={themed($body)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ref={scrollRef}
              style={themed($bodyScroll)}
            >
              {children}
            </ScrollView>
            <View style={themed($actions)}>
              {!!secondarySaveLabel && !!onSecondarySave && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: saving, disabled: saving || !canSave }}
                  disabled={saving || !canSave}
                  onPress={onSecondarySave}
                  style={({ pressed }) =>
                    themed([
                      $secondarySaveButton,
                      pressed && $saveButtonPressed,
                      (saving || !canSave) && $saveButtonDisabled,
                    ])
                  }
                >
                  <Text text={secondarySaveLabel} style={themed($secondarySaveButtonText)} />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: saving, disabled: saving || !canSave }}
                disabled={saving || !canSave}
                onPress={onSave}
                style={({ pressed }) =>
                  themed([
                    $saveButton,
                    pressed && $saveButtonPressed,
                    (saving || !canSave) && $saveButtonDisabled,
                  ])
                }
              >
                {saving ? (
                  <ActivityIndicator color={colors.palette.surfaceDim} size="small" />
                ) : (
                  <MaterialCommunityIcons
                    name="check"
                    color={colors.palette.surfaceDim}
                    size={20}
                  />
                )}
                <Text text={saving ? "Saving..." : saveLabel} style={themed($saveButtonText)} />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const $keyboardView: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
const $overlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.overlay50,
  flex: 1,
  justifyContent: "flex-end",
})
const $sheet: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  borderWidth: 1,
  gap: spacing.md,
  maxHeight: "90%",
  padding: spacing.md,
  paddingBottom: spacing.xl,
})
const $header: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 22,
})
const $close: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 20,
  height: 40,
  justifyContent: "center",
  width: 40,
})
const $body: ThemedStyle<ViewStyle> = ({ spacing }) => ({ gap: spacing.sm })
const $bodyScroll: ThemedStyle<ViewStyle> = () => ({
  flexShrink: 1,
})
const $actions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})
const $saveButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.tint,
  borderRadius: 18,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "center",
  minHeight: 48,
  paddingHorizontal: spacing.md,
})
const $secondarySaveButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderColor: colors.tint,
  borderRadius: 18,
  borderWidth: 1,
  justifyContent: "center",
  minHeight: 48,
  paddingHorizontal: spacing.md,
})
const $saveButtonPressed: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.86,
})
const $saveButtonDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.45,
})
const $saveButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
})
const $secondarySaveButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
})
