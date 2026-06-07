import { useEffect, useMemo, useState } from "react"
import { FlatList, Modal, Pressable, StyleSheet, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useKeyboardState } from "react-native-keyboard-controller"

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
  creatable?: boolean
  onSelect: (ids: string[]) => void
  onCreate?: (value: string) => void
  onClose: () => void
}

export function SelectionSheet({
  visible,
  title,
  items,
  selectedIds,
  multiple = false,
  creatable = false,
  onSelect,
  onCreate,
  onClose,
}: SelectionSheetProps) {
  const { themed } = useAppTheme()
  const [search, setSearch] = useState("")
  const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0))
  const keyboardInset = keyboardHeight
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = query
      ? items.filter((item) => `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(query))
      : items
    if (!multiple) return matches

    return [...matches].sort((left, right) => {
      const leftSelected = selectedIds.includes(left.id)
      const rightSelected = selectedIds.includes(right.id)
      if (leftSelected === rightSelected) return 0
      return leftSelected ? -1 : 1
    })
  }, [items, multiple, search, selectedIds])
  const createValue = search.trim().replace(/^#+/, "").trim()
  const canCreate =
    creatable &&
    !!createValue &&
    !items.some((item) => item.title.trim().toLocaleLowerCase() === createValue.toLocaleLowerCase())

  useEffect(() => {
    if (!visible) setSearch("")
  }, [visible])

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
      navigationBarTranslucent
    >
      <View style={themed($overlay)}>
        <Pressable style={themed($dismissArea)} onPress={onClose} />
        <View
          pointerEvents="box-none"
          style={[themed($keyboardInset), { paddingBottom: keyboardInset }]}
          testID="selection-sheet-keyboard-inset"
        >
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
            <View style={themed($results)}>
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={themed($resultsList)}
                contentContainerStyle={themed([
                  $list,
                  filteredItems.length === 0 && !canCreate && $emptyList,
                ])}
                ListHeaderComponent={
                  canCreate ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add tag ${createValue}`}
                      onPress={() => {
                        onCreate?.(createValue)
                        setSearch("")
                      }}
                      style={themed($item)}
                    >
                      <View style={themed($itemIcon)}>
                        <MaterialCommunityIcons name="plus" size={20} style={themed($icon)} />
                      </View>
                      <View style={themed($itemText)}>
                        <Text text={`Add "${createValue}"`} style={themed($itemTitle)} />
                        <Text text="Create a new tag" style={themed($subtitle)} />
                      </View>
                    </Pressable>
                  ) : null
                }
                ListEmptyComponent={
                  canCreate ? null : <Text text="No matches found." style={themed($empty)} />
                }
                renderItem={({ item }) => {
                  const selected = selectedIds.includes(item.id)
                  return (
                    <Pressable
                      accessibilityRole={multiple ? "checkbox" : "radio"}
                      accessibilityLabel={item.title}
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
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          style={themed($check)}
                        />
                      )}
                    </Pressable>
                  )
                }}
              />
            </View>
            {multiple && (
              <Pressable accessibilityRole="button" onPress={onClose} style={themed($doneButton)}>
                <Text text="Done" style={themed($doneText)} />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const $overlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.overlay80,
  flex: 1,
  justifyContent: "flex-end",
})

const $dismissArea: ThemedStyle<ViewStyle> = () => ({
  ...StyleSheet.absoluteFillObject,
})

const $keyboardInset: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "flex-end",
})

const $sheet: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  flexShrink: 1,
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

const $results: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  minHeight: 0,
})

const $resultsList: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $list: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  paddingBottom: spacing.xl,
  paddingTop: spacing.xs,
})

const $emptyList: ThemedStyle<ViewStyle> = () => ({
  justifyContent: "center",
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

const $doneButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.primary300,
  borderRadius: 12,
  justifyContent: "center",
  marginBottom: spacing.md,
  minHeight: 48,
})

const $doneText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
  fontSize: 15,
})
