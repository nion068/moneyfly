import { FC, useState } from "react"
import { Alert, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { SettingsEditorModal } from "@/components/settings/SettingsEditorModal"
import { SettingsHeader, SettingsSection } from "@/components/settings/SettingsPrimitives"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import type { SettingsStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Props = SettingsStackScreenProps<"SettingsClassification">
type Editor = { kind: "category" | "tag"; id?: string; value: string } | null

export const SettingsClassificationScreen: FC<Props> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    isConfigured,
    categories,
    tags,
    settingsMutation,
    saveCategory,
    deleteCategory,
    saveTag,
    deleteTag,
  } = useFirefly()
  const [editor, setEditor] = useState<Editor>(null)
  const [value, setValue] = useState("")
  const [search, setSearch] = useState("")
  const normalizedSearch = search.trim().toLowerCase()
  const visibleCategories = normalizedSearch
    ? categories.data.filter((category) =>
        category.attributes.name.toLowerCase().includes(normalizedSearch),
      )
    : categories.data
  const visibleTags = normalizedSearch
    ? tags.data.filter((tag) => tag.attributes.tag.toLowerCase().includes(normalizedSearch))
    : tags.data

  function openEditor(next: NonNullable<Editor>) {
    if (!isConfigured) {
      navigation.navigate("SettingsFirefly")
      return
    }
    setEditor(next)
    setValue(next.value)
  }

  async function saveCurrent(keepOpenOnSuccess = false) {
    if (!editor) return
    const ok =
      editor.kind === "category"
        ? await saveCategory({ name: value.trim() }, editor.id)
        : await saveTag({ tag: value.trim() }, editor.id)
    if (!ok) return
    if (keepOpenOnSuccess) setValue("")
    else setEditor(null)
  }

  function confirmDelete(kind: "category" | "tag", id: string, label: string) {
    if (!isConfigured) {
      navigation.navigate("SettingsFirefly")
      return
    }
    Alert.alert(
      `Delete ${kind}?`,
      `"${label}" will be removed from Firefly. Existing transactions may retain historical values.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void (kind === "category" ? deleteCategory(id) : deleteTag(id)),
        },
      ],
    )
  }

  return (
    <>
      <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
        <SettingsHeader title="Classification" onBack={navigation.goBack} />

        <TextField
          accessibilityLabel="Search categories and tags"
          value={search}
          onChangeText={setSearch}
          placeholder="Search categories and tags"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={themed($searchContainer)}
          inputWrapperStyle={themed($searchInputWrapper)}
          style={themed($searchInput)}
          LeftAccessory={({ style }) => (
            <View style={[style, themed($searchAccessory)]}>
              <MaterialCommunityIcons name="magnify" color={colors.textDim} size={22} />
            </View>
          )}
          RightAccessory={
            search
              ? ({ style }) => (
                  <Pressable
                    accessibilityLabel="Clear classification search"
                    onPress={() => setSearch("")}
                    style={[style, themed($searchAccessory)]}
                  >
                    <MaterialCommunityIcons name="close" color={colors.textDim} size={20} />
                  </Pressable>
                )
              : undefined
          }
        />

        <SettingsSection
          title={`Categories · ${visibleCategories.length}`}
          collapsible
          headerAction={
            <Pressable
              accessibilityLabel="Add category"
              onPress={() => openEditor({ kind: "category", value: "" })}
              style={themed($sectionAdd)}
            >
              <MaterialCommunityIcons name="plus" color={colors.tint} size={20} />
              <Text text="New" style={themed($sectionAddText)} />
            </Pressable>
          }
        >
          {visibleCategories.map((category, index) => (
            <ClassificationRow
              key={category.id}
              label={category.attributes.name}
              first={index === 0}
              onEdit={() =>
                openEditor({
                  kind: "category",
                  id: category.id,
                  value: category.attributes.name,
                })
              }
              onDelete={() => confirmDelete("category", category.id, category.attributes.name)}
            />
          ))}
          {visibleCategories.length === 0 ? (
            <Text text="No categories match this search." style={themed($empty)} />
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={`Tags · ${visibleTags.length}`}
          collapsible
          headerAction={
            <Pressable
              accessibilityLabel="Add tag"
              onPress={() => openEditor({ kind: "tag", value: "" })}
              style={themed($sectionAdd)}
            >
              <MaterialCommunityIcons name="plus" color={colors.tint} size={20} />
              <Text text="New" style={themed($sectionAddText)} />
            </Pressable>
          }
        >
          <View style={themed($tags)}>
            {visibleTags.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => openEditor({ kind: "tag", id: tag.id, value: tag.attributes.tag })}
                onLongPress={() => confirmDelete("tag", tag.id, tag.attributes.tag)}
                style={themed($tag)}
              >
                <Text text={`#${tag.attributes.tag}`} style={themed($tagText)} />
                <MaterialCommunityIcons name="pencil-outline" color={colors.textDim} size={15} />
              </Pressable>
            ))}
          </View>
          {visibleTags.length === 0 ? (
            <Text text="No tags match this search." style={themed($empty)} />
          ) : null}
          <Text
            text="Long-press a tag to delete it. Classification groups are deferred until a real data model is defined."
            style={themed($help)}
          />
        </SettingsSection>

        {categories.error || tags.error ? (
          <Text text={(categories.error ?? tags.error)?.message} style={themed($error)} />
        ) : null}
      </Screen>

      <SettingsEditorModal
        visible={!!editor}
        title={`${editor?.id ? "Edit" : "New"} ${editor?.kind === "tag" ? "Tag" : "Category"}`}
        saving={settingsMutation.status === "loading"}
        canSave={!!value.trim()}
        focusOnChangeKey={settingsMutation.error?.message ?? ""}
        secondarySaveLabel={editor?.id ? undefined : "Save and Add Another"}
        onClose={() => setEditor(null)}
        onSave={() => void saveCurrent()}
        onSecondarySave={editor?.id ? undefined : () => void saveCurrent(true)}
      >
        <TextField
          accessibilityLabel={editor?.kind === "tag" ? "Tag" : "Category name"}
          label={editor?.kind === "tag" ? "Tag" : "Category name"}
          value={value}
          onChangeText={setValue}
          autoCapitalize={editor?.kind === "tag" ? "none" : "sentences"}
        />
        {editor?.id ? (
          <Pressable
            onPress={() => {
              if (!editor) return
              setEditor(null)
              confirmDelete(editor.kind, editor.id!, editor.value)
            }}
            style={themed($delete)}
          >
            <Text text={`Delete ${editor.kind}`} style={themed($deleteText)} />
          </Pressable>
        ) : null}
        {settingsMutation.error ? (
          <Text text={settingsMutation.error.message} style={themed($error)} />
        ) : null}
      </SettingsEditorModal>
    </>
  )
}

function ClassificationRow({
  label,
  first,
  onEdit,
  onDelete,
}: {
  label: string
  first: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <Pressable onLongPress={onDelete} onPress={onEdit} style={themed([$row, first && $firstRow])}>
      <Text text={label} style={themed($rowText)} />
      <View style={themed($edit)}>
        <MaterialCommunityIcons name="pencil-outline" color={colors.textDim} size={20} />
      </View>
    </Pressable>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: 112,
})
const $searchContainer: ThemedStyle<ViewStyle> = () => ({
  width: "100%",
})
const $searchInputWrapper: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 18,
  height: 48,
})
const $searchInput: ThemedStyle<TextStyle> = ({ colors }) => ({
  alignSelf: "center",
  color: colors.text,
  fontSize: 14,
  height: 48,
  lineHeight: 20,
  marginHorizontal: 0,
  marginVertical: 0,
  paddingVertical: 0,
  textAlignVertical: "center",
})
const $searchAccessory: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  justifyContent: "center",
  marginHorizontal: spacing.xs,
  paddingHorizontal: spacing.xs,
})
const $sectionAdd: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xxxs,
  marginLeft: spacing.sm,
  paddingHorizontal: spacing.xs,
  paddingVertical: spacing.xxs,
})
const $sectionAddText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
  fontSize: 12,
})
const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  flexDirection: "row",
  minHeight: 58,
  paddingVertical: spacing.xs,
})
const $firstRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderTopWidth: 0,
  marginTop: spacing.sm,
})
const $rowText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  flex: 1,
  fontSize: 15,
})
const $edit: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 18,
  height: 36,
  justifyContent: "center",
  width: 36,
})
const $tags: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
  paddingTop: spacing.md,
})
const $tag: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderColor: colors.palette.stroke,
  borderRadius: 999,
  borderWidth: 1,
  flexDirection: "row",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})
const $tagText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 14,
})
const $empty: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  paddingTop: spacing.md,
  textAlign: "center",
})
const $help: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  fontSize: 13,
  lineHeight: 19,
  paddingTop: spacing.lg,
})
const $error: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.error })
const $delete: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderColor: colors.palette.tertiary300,
  borderRadius: 16,
  borderWidth: 1,
  padding: spacing.sm,
})
const $deleteText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
})
