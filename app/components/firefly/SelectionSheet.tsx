import { useMemo, useState } from "react"
import { FlatList, Modal, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export type SelectionItem = {
  id: string
  title: string
  subtitle?: string
  icon?: keyof typeof MaterialCommunityIcons.glyphMap
}

type SelectionSheetProps = {
  visible: boolean
  title: string
  items: SelectionItem[]
  selectedIds: string[]
  multiple?: boolean
  onSelect: (ids: string[]) => void
  onClose: () => void
}

export function SelectionSheet({
  visible,
  title,
  items,
  selectedIds,
  multiple = false,
  onSelect,
  onClose,
}: SelectionSheetProps) {
  const { themed } = useAppTheme()
  const [search, setSearch] = useState("")
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query
      ? items.filter((item) => `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(query))
      : items
  }, [items, search])

  const select = (id: string) => {
    if (!multiple) {
      onSelect([id])
      setSearch("")
      onClose()
      return
    }

    onSelect(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={themed($overlay)}>
        <Pressable style={themed($dismissArea)} onPress={onClose} />
        <View style={themed($sheet)}>
          <View style={themed($handle)} />
          <View style={themed($header)}>
            <Text text={title} style={themed($title)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close selector"
              onPress={onClose}
            >
              <MaterialCommunityIcons name="close" size={24} style={themed($icon)} />
            </Pressable>
          </View>
          <TextField
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${title.toLowerCase()}...`}
            autoCapitalize="none"
            inputWrapperStyle={themed($search)}
          />
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={themed($list)}
            ListEmptyComponent={<Text text="No matches found." style={themed($empty)} />}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item.id)
              return (
                <Pressable
                  accessibilityRole={multiple ? "checkbox" : "radio"}
                  accessibilityState={{ selected, checked: selected }}
                  onPress={() => select(item.id)}
                  style={themed($item)}
                >
                  <View style={themed([$itemIcon, selected && $selectedIcon])}>
                    <MaterialCommunityIcons
                      name={item.icon ?? "wallet-outline"}
                      size={20}
                      style={themed($icon)}
                    />
                  </View>
                  <View style={themed($itemText)}>
                    <Text text={item.title} style={themed($itemTitle)} />
                    {!!item.subtitle && <Text text={item.subtitle} style={themed($subtitle)} />}
                  </View>
                  {selected && (
                    <MaterialCommunityIcons name="check-circle" size={22} style={themed($check)} />
                  )}
                </Pressable>
              )
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

const $dismissArea: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $sheet: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  maxHeight: "72%",
  minHeight: "48%",
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
})

const $handle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignSelf: "center",
  backgroundColor: colors.palette.neutral600,
  borderRadius: 3,
  height: 5,
  marginBottom: 12,
  width: 44,
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
  fontSize: 20,
})

const $icon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })

const $search: ThemedStyle<ViewStyle> = () => ({ minHeight: 44 })

const $list: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: spacing.xl,
  paddingTop: spacing.xs,
})

const $item: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 58,
  paddingVertical: spacing.xs,
})

const $itemIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 20,
  height: 40,
  justifyContent: "center",
  width: 40,
})

const $selectedIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary600,
})

const $itemText: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $itemTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 15,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  marginTop: 2,
})

const $check: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint })

const $empty: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  padding: spacing.xl,
  textAlign: "center",
})
