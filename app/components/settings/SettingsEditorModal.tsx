import { ReactNode } from "react"
import { Modal, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function SettingsEditorModal({
  visible,
  title,
  children,
  saveLabel = "Save",
  saving,
  canSave,
  onClose,
  onSave,
}: {
  visible: boolean
  title: string
  children: ReactNode
  saveLabel?: string
  saving?: boolean
  canSave: boolean
  onClose: () => void
  onSave: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={themed($overlay)}>
        <View style={themed($sheet)}>
          <View style={themed($header)}>
            <Text text={title} style={themed($title)} />
            <Pressable accessibilityLabel="Close" onPress={onClose} style={themed($close)}>
              <MaterialCommunityIcons name="close" color={colors.text} size={24} />
            </Pressable>
          </View>
          <View style={themed($body)}>{children}</View>
          <Button
            text={saving ? "Saving..." : saveLabel}
            preset="filled"
            disabled={saving || !canSave}
            onPress={onSave}
          />
        </View>
      </View>
    </Modal>
  )
}

const $overlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.overlay50,
  flex: 1,
  justifyContent: "flex-end",
})
const $sheet: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  borderWidth: 1,
  gap: spacing.lg,
  padding: spacing.lg,
  paddingBottom: spacing.xxl,
})
const $header: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 26,
})
const $close: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 22,
  height: 44,
  justifyContent: "center",
  width: 44,
})
const $body: ThemedStyle<ViewStyle> = ({ spacing }) => ({ gap: spacing.md })
