import { Modal, Platform, Pressable, TextStyle, View, ViewStyle } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type DateTimeFieldPickerProps = {
  visible: boolean
  value: Date
  mode: "date" | "time"
  minimumDate?: Date
  maximumDate?: Date
  onChange: (value: Date) => void
  onClose: () => void
}

export function DateTimeFieldPicker({
  visible,
  value,
  mode,
  minimumDate,
  maximumDate,
  onChange,
  onClose,
}: DateTimeFieldPickerProps) {
  const { themed } = useAppTheme()
  if (!visible) return null

  if (Platform.OS !== "ios") {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={(event, nextValue) => {
          onClose()
          if (event.type !== "dismissed" && nextValue) onChange(nextValue)
        }}
      />
    )
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={themed($overlay)}>
        <Pressable style={themed($dismiss)} onPress={onClose} />
        <View style={themed($sheet)}>
          <View style={themed($header)}>
            <Text text={mode === "date" ? "Select Date" : "Select Time"} style={themed($title)} />
            <Pressable onPress={onClose} style={themed($doneButton)}>
              <Text text="Done" style={themed($doneText)} />
            </Pressable>
          </View>
          <DateTimePicker
            value={value}
            mode={mode}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            display="spinner"
            themeVariant="dark"
            onChange={(_event, nextValue) => {
              if (nextValue) onChange(nextValue)
            }}
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

const $dismiss: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $sheet: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  padding: spacing.md,
  paddingBottom: spacing.xl,
})

const $header: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 44,
})

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 18,
})

const $doneButton: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  minWidth: 52,
})

const $doneText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
})
