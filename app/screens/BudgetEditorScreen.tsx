import { FC, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Modal, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { DateTimeFieldPicker } from "@/components/firefly/DateTimeFieldPicker"
import { SelectionItem, SelectionSheet } from "@/components/firefly/SelectionSheet"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Switch } from "@/components/Toggle/Switch"
import { useFirefly } from "@/context/FireflyContext"
import type { AutoBudgetPeriod, AutoBudgetType } from "@/models/firefly"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import {
  BudgetPeriod,
  formatDateKey,
  getBudgetRange,
  parseAmount,
  startOfBudgetPeriod,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type BudgetEditorScreenProps = AppStackScreenProps<"BudgetEditor">
type BudgetRangeMode = BudgetPeriod | "custom"
type BudgetSelector = "currency" | "period" | "autoBudget" | "autoBudgetPeriod"

const periodFilters: { key: BudgetPeriod; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
]

const periodItems: SelectionItem[] = [
  { id: "month", title: "Month", icon: "calendar-month-outline" },
  { id: "quarter", title: "Quarter", icon: "calendar-range-outline" },
  { id: "year", title: "Year", icon: "calendar-blank-outline" },
  { id: "custom", title: "Custom", icon: "calendar-edit" },
]

const autoBudgetItems: SelectionItem[] = [
  { id: "none", title: "No auto-budget", icon: "calendar-remove-outline" },
  { id: "reset", title: "Set a fixed amount every period", icon: "calendar-sync-outline" },
  { id: "rollover", title: "Add an amount every period", icon: "calendar-plus-outline" },
]

const autoBudgetPeriodItems: SelectionItem[] = [
  { id: "daily", title: "Daily", icon: "calendar-today" },
  { id: "weekly", title: "Weekly", icon: "calendar-week" },
  { id: "monthly", title: "Monthly", icon: "calendar-month-outline" },
  { id: "quarterly", title: "Quarterly", icon: "calendar-range-outline" },
  { id: "half-year", title: "Half-yearly", icon: "calendar-blank-multiple" },
  { id: "yearly", title: "Yearly", icon: "calendar-blank-outline" },
]

const emptyToNull = (value: string) => value.trim() || null
const dateKeyFromString = (value: string) => value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
const normalizeDateKey = (value: string) => dateKeyFromString(value) ?? formatDateKey(new Date())
const formatRange = (start: string, end: string) =>
  `${normalizeDateKey(start)} - ${normalizeDateKey(end)}`
const parseDateKey = (value: string) => {
  const dateKey = dateKeyFromString(value)
  return dateKey ? new Date(`${dateKey}T12:00:00`) : new Date()
}

function inferRangeMode(start: string, end: string): BudgetRangeMode {
  const anchor = parseDateKey(start)
  const currentRange = formatRange(normalizeDateKey(start), normalizeDateKey(end))
  const monthRange = getBudgetRange(anchor, "month")
  const quarterRange = getBudgetRange(anchor, "quarter")
  const yearRange = getBudgetRange(anchor, "year")

  if (currentRange === formatRange(monthRange.start, monthRange.end)) return "month"
  if (currentRange === formatRange(quarterRange.start, quarterRange.end)) return "quarter"
  if (currentRange === formatRange(yearRange.start, yearRange.end)) return "year"
  return "custom"
}

function selectorTitle(selector?: BudgetSelector) {
  if (selector === "currency") return "Currency"
  if (selector === "autoBudget") return "Auto-budget"
  if (selector === "autoBudgetPeriod") return "Auto-budget Period"
  return "Range"
}

function selectorItems(selector: BudgetSelector | undefined, currencyItems: SelectionItem[]) {
  if (selector === "currency") return currencyItems
  if (selector === "autoBudget") return autoBudgetItems
  if (selector === "autoBudgetPeriod") return autoBudgetPeriodItems
  return periodItems
}

function selectorSelectedId(
  selector: BudgetSelector | undefined,
  currency: string,
  rangeMode: BudgetRangeMode,
  autoBudgetType: AutoBudgetType,
  autoBudgetPeriod: AutoBudgetPeriod,
) {
  if (selector === "currency") return currency
  if (selector === "autoBudget") return autoBudgetType
  if (selector === "autoBudgetPeriod") return autoBudgetPeriod
  return rangeMode
}

export const BudgetEditorScreen: FC<BudgetEditorScreenProps> = ({ navigation, route }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    isConfigured,
    budgets,
    budgetLimits,
    currencies,
    selectedCurrency,
    selectedBudgetPeriod,
    selectedBudgetAnchor,
    budgetMutation,
    saveBudgetWithLimit,
    deleteBudget,
    resetBudgetMutation,
  } = useFirefly()
  const budgetId = route.params?.budgetId
  const limitId = route.params?.limitId
  const editingBudget = budgetId ? budgets.data.find((budget) => budget.id === budgetId) : undefined
  const editingLimit = limitId
    ? budgetLimits.data.find((limit) => limit.id === limitId)
    : budgetId
      ? budgetLimits.data.find((limit) => limit.attributes.budget_id === budgetId)
      : undefined
  const isEditing = !!budgetId
  const [selectorVisible, setSelectorVisible] = useState<BudgetSelector>()
  const [datePickerVisible, setDatePickerVisible] = useState<"start" | "end">()
  const [validationError, setValidationError] = useState<string>()
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [rangeMode, setRangeMode] = useState<BudgetRangeMode>(selectedBudgetPeriod)
  const [autoBudgetType, setAutoBudgetType] = useState<AutoBudgetType>("none")
  const [autoBudgetAmount, setAutoBudgetAmount] = useState("")
  const [autoBudgetPeriod, setAutoBudgetPeriod] = useState<AutoBudgetPeriod>("monthly")
  const [startDate, setStartDate] = useState(selectedBudgetAnchor)
  const [endDate, setEndDate] = useState(selectedBudgetAnchor)
  const [active, setActive] = useState(true)
  const [notes, setNotes] = useState("")

  const selectedBudgetAnchorTime = selectedBudgetAnchor.getTime()
  const defaultCurrency =
    currencies.data.find((item) => item.attributes.code === selectedCurrency)?.attributes.code ??
    currencies.data.find((item) => item.attributes.primary)?.attributes.code ??
    currencies.data[0]?.attributes.code ??
    ""
  const effectivePeriod = rangeMode === "custom" ? selectedBudgetPeriod : rangeMode
  const anchor = startOfBudgetPeriod(selectedBudgetAnchor, effectivePeriod)
  const range =
    rangeMode === "custom"
      ? { start: formatDateKey(startDate), end: formatDateKey(endDate) }
      : getBudgetRange(anchor, rangeMode)
  const currencyItems = useMemo(
    () =>
      currencies.data.map((item) => ({
        id: item.attributes.code,
        title: `${item.attributes.code} - ${item.attributes.name}`,
        subtitle: item.attributes.primary ? "Primary currency" : item.attributes.symbol,
        icon: "cash" as const,
      })),
    [currencies.data],
  )
  const autoBudgetEnabled = autoBudgetType !== "none"
  const isSaving = budgetMutation.status === "loading"
  const missingBudget = isEditing && budgets.status !== "loading" && !editingBudget

  useEffect(() => {
    if (!isConfigured) {
      navigation.replace("Main", {
        screen: "Settings",
        params: { screen: "SettingsFirefly" },
      })
    }
  }, [isConfigured, navigation])

  useEffect(() => {
    resetBudgetMutation()
    return resetBudgetMutation
  }, [resetBudgetMutation])

  useEffect(() => {
    const selectedBudgetAnchorDate = new Date(selectedBudgetAnchorTime)
    const initialRange = editingLimit
      ? { start: editingLimit.attributes.start, end: editingLimit.attributes.end }
      : getBudgetRange(
          startOfBudgetPeriod(selectedBudgetAnchorDate, selectedBudgetPeriod),
          selectedBudgetPeriod,
        )

    setName(editingBudget?.attributes.name ?? "")
    setAmount(editingLimit ? parseAmount(editingLimit.attributes.amount).toFixed(2) : "")
    setCurrency(
      editingLimit?.attributes.currency_code ??
        editingBudget?.attributes.currency_code ??
        defaultCurrency,
    )
    setRangeMode(
      editingLimit
        ? inferRangeMode(editingLimit.attributes.start, editingLimit.attributes.end)
        : selectedBudgetPeriod,
    )
    setAutoBudgetType(editingBudget?.attributes.auto_budget_type ?? "none")
    setAutoBudgetAmount(
      editingBudget?.attributes.auto_budget_amount
        ? parseAmount(editingBudget.attributes.auto_budget_amount).toFixed(2)
        : "",
    )
    setAutoBudgetPeriod(editingBudget?.attributes.auto_budget_period ?? "monthly")
    setStartDate(parseDateKey(initialRange.start))
    setEndDate(parseDateKey(initialRange.end))
    setActive(editingBudget?.attributes.active !== false)
    setNotes(editingLimit?.attributes.notes ?? editingBudget?.attributes.notes ?? "")
    setValidationError(undefined)
    setSelectorVisible(undefined)
    setDatePickerVisible(undefined)
  }, [defaultCurrency, editingBudget, editingLimit, selectedBudgetAnchorTime, selectedBudgetPeriod])

  async function save() {
    resetBudgetMutation()
    setValidationError(undefined)
    if (!name.trim()) {
      setValidationError("Name is required.")
      return
    }
    if (!amount.trim() || !Number.isFinite(Number(amount))) {
      setValidationError("Amount must be a valid number.")
      return
    }
    if (Number(amount) <= 0) {
      setValidationError("Amount must be greater than zero.")
      return
    }
    if (!currency) {
      setValidationError("Currency is required.")
      return
    }
    if (range.start > range.end) {
      setValidationError("Start date must be before or equal to end date.")
      return
    }
    if (
      autoBudgetEnabled &&
      (!autoBudgetAmount.trim() || !Number.isFinite(Number(autoBudgetAmount)))
    ) {
      setValidationError("Auto-budget amount must be a valid number.")
      return
    }
    if (autoBudgetEnabled && Number(autoBudgetAmount) <= 0) {
      setValidationError("Auto-budget amount must be greater than zero.")
      return
    }

    const saved = await saveBudgetWithLimit(
      {
        name: name.trim(),
        active,
        notes: emptyToNull(notes),
        fire_webhooks: true,
        auto_budget_type: autoBudgetType,
        auto_budget_currency_code: autoBudgetEnabled ? currency : null,
        auto_budget_amount: autoBudgetEnabled ? Number(autoBudgetAmount).toFixed(2) : null,
        auto_budget_period: autoBudgetEnabled ? autoBudgetPeriod : null,
      },
      {
        currency_code: currency,
        start: range.start,
        end: range.end,
        amount: Number(amount).toFixed(2),
        notes: emptyToNull(notes),
        fire_webhooks: true,
      },
      editingBudget,
      editingLimit,
    )
    if (saved) navigation.goBack()
  }

  async function confirmDeleteBudget() {
    if (!editingBudget) return
    const deleted = await deleteBudget(editingBudget.id)
    if (!deleted) return
    setDeleteDialogVisible(false)
    navigation.goBack()
  }

  function closeDeleteDialog() {
    if (!isSaving) setDeleteDialogVisible(false)
  }

  if (!isConfigured) return null

  return (
    <>
      <Screen
        preset="scroll"
        safeAreaEdges={["top", "bottom"]}
        contentContainerStyle={themed($container)}
        footer={
          selectorVisible ? undefined : (
            <View style={themed($footerActions)}>
              {isEditing ? (
                <Button
                  text="Delete budget"
                  disabled={isSaving || !editingBudget}
                  onPress={() => setDeleteDialogVisible(true)}
                  style={themed($deleteButton)}
                  textStyle={themed($deleteButtonText)}
                  disabledStyle={themed($disabledButton)}
                />
              ) : null}
              <Button
                text={isSaving ? "Saving..." : "Save"}
                LeftAccessory={
                  isSaving
                    ? () => <ActivityIndicator color={colors.palette.surfaceDim} size="small" />
                    : undefined
                }
                disabled={isSaving || missingBudget}
                onPress={() => void save()}
                style={themed($saveButton)}
                textStyle={themed($saveText)}
                disabledStyle={themed($disabledButton)}
              />
            </View>
          )
        }
        footerStyle={themed($footer)}
      >
        <View style={themed($header)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Close edit budget" : "Close new budget"}
            onPress={() => navigation.goBack()}
            style={themed($roundButton)}
          >
            <MaterialCommunityIcons name="close" size={24} style={themed($icon)} />
          </Pressable>
          <Text text={isEditing ? "Edit Budget" : "New Budget"} style={themed($title)} />
          <View style={themed($headerSpacer)} />
        </View>

        <View style={themed($formCard)}>
          {missingBudget ? (
            <Text
              text="This budget could not be found. Refresh and retry."
              style={themed($negative)}
            />
          ) : null}
          <TextField
            accessibilityLabel="Budget name"
            label="Name"
            value={name}
            onChangeText={setName}
            inputWrapperStyle={themed($inputWrapper)}
            style={themed($inputText)}
          />
          <TextField
            accessibilityLabel="Budget amount"
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            inputWrapperStyle={themed($inputWrapper)}
            style={themed($inputText)}
          />
          <SelectorField
            label="Currency"
            value={currency}
            onPress={() => setSelectorVisible("currency")}
          />
          <SelectorField
            label="Auto-budget"
            value={autoBudgetItems.find((item) => item.id === autoBudgetType)?.title}
            onPress={() => setSelectorVisible("autoBudget")}
          />
          {autoBudgetEnabled ? (
            <>
              <TextField
                accessibilityLabel="Auto-budget amount"
                label="Auto-budget amount"
                value={autoBudgetAmount}
                onChangeText={setAutoBudgetAmount}
                keyboardType="decimal-pad"
                inputWrapperStyle={themed($inputWrapper)}
                style={themed($inputText)}
              />
              <SelectorField
                label="Auto-budget period"
                value={autoBudgetPeriodItems.find((item) => item.id === autoBudgetPeriod)?.title}
                onPress={() => setSelectorVisible("autoBudgetPeriod")}
              />
            </>
          ) : null}
          <SelectorField
            label="Range"
            value={
              rangeMode === "custom"
                ? "Custom"
                : periodFilters.find((item) => item.key === rangeMode)?.label
            }
            onPress={() => setSelectorVisible("period")}
          />
          {rangeMode === "custom" ? (
            <View style={themed($dateRow)}>
              <DateSelectorField
                label="Start Date"
                value={range.start}
                onPress={() => setDatePickerVisible("start")}
              />
              <DateSelectorField
                label="End Date"
                value={range.end}
                onPress={() => setDatePickerVisible("end")}
              />
            </View>
          ) : null}
          <View style={themed($rangePreview)}>
            <Text text="Range" style={themed($fieldLabel)} />
            <Text text={`${range.start} to ${range.end}`} style={themed($rangeText)} />
          </View>
          <Switch label="Active" value={active} onValueChange={setActive} />
          <TextField
            accessibilityLabel="Budget notes"
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Optional"
            inputWrapperStyle={themed($inputWrapper)}
            style={themed($inputText)}
          />
          {!!(validationError || budgetMutation.error) && (
            <Text
              text={validationError ?? budgetMutation.error?.message}
              style={themed($negative)}
            />
          )}
        </View>
      </Screen>

      <SelectionSheet
        visible={!!selectorVisible}
        title={selectorTitle(selectorVisible)}
        items={selectorItems(selectorVisible, currencyItems)}
        selectedIds={[
          selectorSelectedId(
            selectorVisible,
            currency,
            rangeMode,
            autoBudgetType,
            autoBudgetPeriod,
          ),
        ]}
        onSelect={(ids) => {
          const value = ids[0]
          if (!value) return
          if (selectorVisible === "currency") setCurrency(value)
          if (selectorVisible === "period") setRangeMode(value as BudgetRangeMode)
          if (selectorVisible === "autoBudget") setAutoBudgetType(value as AutoBudgetType)
          if (selectorVisible === "autoBudgetPeriod") setAutoBudgetPeriod(value as AutoBudgetPeriod)
        }}
        onClose={() => setSelectorVisible(undefined)}
      />
      <DateTimeFieldPicker
        visible={datePickerVisible === "start"}
        value={startDate}
        mode="date"
        onChange={setStartDate}
        onClose={() => setDatePickerVisible(undefined)}
      />
      <DateTimeFieldPicker
        visible={datePickerVisible === "end"}
        value={endDate}
        mode="date"
        onChange={setEndDate}
        onClose={() => setDatePickerVisible(undefined)}
      />
      <Modal
        visible={deleteDialogVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeDeleteDialog}
      >
        <View style={themed($dialogOverlay)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close delete budget confirmation"
            disabled={isSaving}
            onPress={closeDeleteDialog}
            style={themed($dialogBackdrop)}
          />
          <View accessibilityRole="alert" accessibilityViewIsModal style={themed($dialog)}>
            <View style={themed($dialogIcon)}>
              <MaterialCommunityIcons name="delete-outline" size={28} style={themed($deleteIcon)} />
            </View>
            <Text text="Delete budget?" style={themed($dialogTitle)} />
            <Text
              text={`This permanently deletes "${editingBudget?.attributes.name ?? "this budget"}" from Firefly. Existing transactions may retain historical values.`}
              style={themed($dialogMessage)}
            />
            {budgetMutation.status === "error" && (
              <Text
                text={budgetMutation.error?.message ?? "Could not delete this budget."}
                style={themed($negative)}
              />
            )}
            <View style={themed($dialogActions)}>
              <Button
                text="Cancel"
                disabled={isSaving}
                onPress={closeDeleteDialog}
                style={themed($cancelButton)}
                textStyle={themed($cancelButtonText)}
                disabledStyle={themed($disabledButton)}
              />
              <Button
                text={isSaving ? "Deleting..." : "Delete"}
                accessibilityLabel="Confirm delete budget"
                disabled={isSaving}
                onPress={() => void confirmDeleteBudget()}
                style={themed($confirmDeleteButton)}
                textStyle={themed($confirmDeleteButtonText)}
                disabledStyle={themed($disabledButton)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

function DateSelectorField({
  label,
  value,
  onPress,
}: {
  label: string
  value: string
  onPress: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View style={themed($dateField)}>
      <Text text={label} style={themed($fieldLabel)} />
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onPress}
        style={themed($selectorField)}
      >
        <Text text={value} style={themed($selectorValue)} />
        <MaterialCommunityIcons name="calendar" color={colors.textDim} size={20} />
      </Pressable>
    </View>
  )
}

function SelectorField({
  label,
  value,
  onPress,
}: {
  label: string
  value?: string
  onPress: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View>
      <Text text={label} style={themed($fieldLabel)} />
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onPress}
        style={themed($selectorField)}
      >
        <Text text={value || "Select"} style={themed(value ? $selectorValue : $placeholder)} />
        <MaterialCommunityIcons name="chevron-down" color={colors.textDim} size={20} />
      </Pressable>
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: spacing.lg,
})
const $footer: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  paddingHorizontal: spacing.md,
  paddingTop: spacing.sm,
})
const $footerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})
const $header: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})
const $roundButton: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  height: 44,
  justifyContent: "center",
  width: 44,
})
const $headerSpacer: ThemedStyle<ViewStyle> = () => ({ width: 44 })
const $icon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.bold,
  fontSize: 22,
})
const $formCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 18,
  gap: spacing.md,
  padding: spacing.md,
})
const $inputWrapper: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  minHeight: 48,
})
const $inputText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 15,
})
const $fieldLabel: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 13,
  lineHeight: 18,
  marginBottom: 6,
})
const $selectorField: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 48,
  paddingHorizontal: spacing.md,
})
const $selectorValue: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  flex: 1,
  fontFamily: typography.primary.medium,
  fontSize: 15,
})
const $placeholder: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  fontSize: 15,
})
const $rangePreview: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  padding: spacing.md,
})
const $rangeText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 14,
})
const $dateRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})
const $dateField: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  minWidth: 0,
})
const $negative: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})
const $saveButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary300,
  borderColor: colors.palette.primary300,
  borderRadius: 14,
  flex: 1,
  minHeight: 50,
})
const $saveText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
})
const $deleteButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 14,
  flex: 1,
  minHeight: 50,
})
const $deleteButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.semiBold,
})
const $dialogOverlay: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.overlay50,
  flex: 1,
  justifyContent: "center",
  padding: spacing.lg,
})
const $dialogBackdrop: ThemedStyle<ViewStyle> = () => ({
  bottom: 0,
  left: 0,
  position: "absolute",
  right: 0,
  top: 0,
})
const $dialog: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 24,
  borderWidth: 1,
  gap: spacing.sm,
  maxWidth: 420,
  padding: spacing.lg,
  width: "100%",
})
const $dialogIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "rgba(216, 113, 98, 0.14)",
  borderRadius: 28,
  height: 56,
  justifyContent: "center",
  marginBottom: 4,
  width: 56,
})
const $deleteIcon: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
})
const $dialogTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 20,
  textAlign: "center",
})
const $dialogMessage: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  lineHeight: 20,
  textAlign: "center",
})
const $dialogActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginTop: spacing.xs,
  width: "100%",
})
const $cancelButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 14,
  flex: 1,
  minHeight: 48,
})
const $cancelButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})
const $confirmDeleteButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.tertiary300,
  borderColor: colors.palette.tertiary300,
  borderRadius: 14,
  flex: 1,
  minHeight: 48,
})
const $confirmDeleteButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
})
const $disabledButton: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.45,
})
