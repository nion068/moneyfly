import { FC, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { DateTimeFieldPicker } from "@/components/firefly/DateTimeFieldPicker"
import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { SelectionItem, SelectionSheet } from "@/components/firefly/SelectionSheet"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import type { FireflyAccount, TransactionType } from "@/models/firefly"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import {
  findCashWallet,
  formatMoney,
  isExpenseAccount,
  isOwnedAccount,
  isRevenueAccount,
  manualTransactionToStoreRequest,
  manualTransactionToUpdateRequest,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type AddTransactionScreenProps = AppStackScreenProps<"AddTransaction" | "EditTransaction">
type SelectorKind = "source" | "destination" | "category"

const transactionTypes: { label: string; value: TransactionType }[] = [
  { label: "Expense", value: "withdrawal" },
  { label: "Income", value: "deposit" },
  { label: "Transfer", value: "transfer" },
]

export const AddTransactionScreen: FC<AddTransactionScreenProps> = ({ navigation, route }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const isEditing = route.name === "EditTransaction"
  const editParams = isEditing ? route.params : undefined
  const {
    accounts,
    categories,
    createTransaction,
    transactionCreation,
    resetTransactionCreation,
    selectedMonth,
    setSelectedMonth,
    refresh,
    transactionDetail,
    loadTransaction,
    transactionUpdate,
    updateTransaction,
    resetTransactionUpdate,
  } = useFirefly()
  const [type, setType] = useState<TransactionType>("withdrawal")
  const [amount, setAmount] = useState("0.00")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date())
  const [sourceId, setSourceId] = useState("")
  const [destinationId, setDestinationId] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [tags, setTags] = useState("")
  const [notes, setNotes] = useState("")
  const [selector, setSelector] = useState<SelectorKind>()
  const [datePickerMode, setDatePickerMode] = useState<"date" | "time">()
  const [validationError, setValidationError] = useState<string>()
  const [isCompleting, setIsCompleting] = useState(false)
  const initializedEditId = useRef<string | null>(null)

  const ownedAccounts = useMemo(() => accounts.data.filter(isOwnedAccount), [accounts.data])
  const expenseAccounts = useMemo(() => accounts.data.filter(isExpenseAccount), [accounts.data])
  const revenueAccounts = useMemo(() => accounts.data.filter(isRevenueAccount), [accounts.data])
  const cashWallet = useMemo(() => findCashWallet(ownedAccounts), [ownedAccounts])

  const sourceAccounts =
    type === "deposit" ? revenueAccounts : type === "transfer" ? ownedAccounts : ownedAccounts
  const destinationAccounts =
    type === "withdrawal" ? expenseAccounts : type === "transfer" ? ownedAccounts : ownedAccounts

  useEffect(() => {
    resetTransactionCreation()
    resetTransactionUpdate()
    return () => {
      resetTransactionCreation()
      resetTransactionUpdate()
    }
  }, [resetTransactionCreation, resetTransactionUpdate])

  useEffect(() => {
    if (isEditing) return
    const preferredOwned = cashWallet ?? ownedAccounts[0]
    if (type === "withdrawal") {
      setSourceId(preferredOwned?.id ?? "")
      setDestinationId(expenseAccounts[0]?.id ?? "")
    } else if (type === "deposit") {
      setSourceId(revenueAccounts[0]?.id ?? "")
      setDestinationId(preferredOwned?.id ?? "")
    } else {
      setSourceId(preferredOwned?.id ?? "")
      setDestinationId(ownedAccounts.find((account) => account.id !== preferredOwned?.id)?.id ?? "")
    }
  }, [cashWallet, expenseAccounts, isEditing, ownedAccounts, revenueAccounts, type])

  useEffect(() => {
    if (!isEditing || !editParams?.groupId) return
    if (transactionDetail.data?.id !== editParams.groupId) {
      void loadTransaction(editParams.groupId)
    }
  }, [editParams?.groupId, isEditing, loadTransaction, transactionDetail.data?.id])

  useEffect(() => {
    if (!isEditing || !editParams || transactionDetail.data?.id !== editParams.groupId) return
    if (initializedEditId.current === editParams.groupId) return
    const split =
      transactionDetail.data.attributes.transactions.find(
        (transaction) => transaction.transaction_journal_id === editParams.journalId,
      ) ?? transactionDetail.data.attributes.transactions[0]
    if (!split || transactionDetail.data.attributes.transactions.length !== 1) return

    initializedEditId.current = editParams.groupId
    setType(split.type)
    setAmount(Number(split.amount).toFixed(2))
    setDescription(split.description)
    setDate(new Date(split.date))
    setSourceId(split.source_id ?? "")
    setDestinationId(split.destination_id ?? "")
    setCategoryName(split.category_name ?? "")
    setTags(split.tags?.join(", ") ?? "")
    setNotes(split.notes ?? "")
  }, [editParams, isEditing, transactionDetail.data])

  const source = sourceAccounts.find((account) => account.id === sourceId)
  const destination = destinationAccounts.find((account) => account.id === destinationId)
  const today = new Date()
  const selectedDateIsToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  const accountItems = (items: FireflyAccount[]): SelectionItem[] =>
    items.map((account) => ({
      id: account.id,
      title: account.attributes.name,
      subtitle:
        account.attributes.current_balance || account.attributes.balance
          ? formatMoney(
              Number(account.attributes.current_balance ?? account.attributes.balance),
              account.attributes.currency_symbol,
            )
          : account.attributes.type,
      icon: isOwnedAccount(account) ? "wallet-outline" : "bank-outline",
    }))

  const selectorItems =
    selector === "source"
      ? accountItems(sourceAccounts)
      : selector === "destination"
        ? accountItems(destinationAccounts)
        : categories.data.map((category) => ({
            id: category.id,
            title: category.attributes.name,
            icon: "shape-outline" as const,
          }))

  const onDateChange = (value: Date) => {
    const now = new Date()
    setDate(value > now ? now : value)
  }

  const submit = async () => {
    resetTransactionCreation()
    resetTransactionUpdate()
    setValidationError(undefined)
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setValidationError("Enter an amount greater than zero.")
      return
    }
    if (!description.trim()) {
      setValidationError("Description is required.")
      return
    }
    if (!sourceId || !destinationId) {
      setValidationError("Select both source and destination accounts.")
      return
    }
    if (type === "transfer" && sourceId === destinationId) {
      setValidationError("Transfer accounts must be different.")
      return
    }
    if (date > new Date()) {
      setValidationError("Future transaction dates are not allowed.")
      return
    }
    if (isEditing && (!editParams?.groupId || !journalIdForEdit())) {
      setValidationError("This transaction could not be prepared for editing. Reload and retry.")
      return
    }

    setIsCompleting(true)
    const input = {
      type,
      date,
      amount: numericAmount,
      description,
      sourceAccountId: sourceId,
      destinationAccountId: destinationId,
      categoryName,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
      notes,
    }
    const journalId = journalIdForEdit()
    const succeeded =
      isEditing && editParams?.groupId && journalId
        ? await updateTransaction(
            editParams.groupId,
            manualTransactionToUpdateRequest(input, journalId),
          )
        : await createTransaction(manualTransactionToStoreRequest(input))
    if (!succeeded) {
      setIsCompleting(false)
      return
    }

    const transactionMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const isSelectedMonth =
      transactionMonth.getFullYear() === selectedMonth.getFullYear() &&
      transactionMonth.getMonth() === selectedMonth.getMonth()
    if (isSelectedMonth) await refresh()
    else setSelectedMonth(transactionMonth)
    if (isEditing) navigation.pop(2)
    else navigation.goBack()
  }

  const isSubmitting =
    isCompleting ||
    transactionCreation.status === "loading" ||
    transactionUpdate.status === "loading"
  const requestError = isEditing ? transactionUpdate.error : transactionCreation.error
  const editGroupIsSplit =
    isEditing &&
    transactionDetail.data?.id === editParams?.groupId &&
    (transactionDetail.data?.attributes.transactions.length ?? 0) !== 1
  const editLoadError = isEditing
    ? (transactionDetail.error?.message ??
      (editGroupIsSplit ? "Split transactions cannot be edited in Moneyfly." : undefined))
    : undefined
  const isLoadingEdit =
    isEditing &&
    !editLoadError &&
    (transactionDetail.status === "loading" ||
      transactionDetail.data?.id !== editParams?.groupId ||
      !initializedEditId.current)

  function journalIdForEdit() {
    return (
      editParams?.journalId ??
      transactionDetail.data?.attributes.transactions[0]?.transaction_journal_id
    )
  }

  return (
    <>
      <Screen
        preset="scroll"
        safeAreaEdges={["top", "bottom"]}
        contentContainerStyle={themed($container)}
        footer={
          <Button
            text={
              isSubmitting
                ? isEditing
                  ? "Updating..."
                  : "Saving..."
                : isEditing
                  ? "Update Transaction"
                  : "Save Transaction"
            }
            LeftAccessory={
              isSubmitting
                ? () => <ActivityIndicator color={colors.palette.surfaceDim} size="small" />
                : undefined
            }
            disabled={isSubmitting || isLoadingEdit || !!editLoadError}
            onPress={() => void submit()}
            style={themed($saveButton)}
            textStyle={themed($saveText)}
            disabledStyle={themed($disabledButton)}
          />
        }
        footerStyle={themed($footer)}
      >
        <View style={themed($header)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Close edit transaction" : "Close new transaction"}
            onPress={() => navigation.goBack()}
            style={themed($roundButton)}
          >
            <MaterialCommunityIcons name="close" size={24} style={themed($icon)} />
          </Pressable>
          <Text text={isEditing ? "Edit Transaction" : "New Transaction"} style={themed($title)} />
          <View style={themed($headerSpacer)} />
        </View>

        <View style={themed($amountBlock)}>
          <Text text="AMOUNT" style={themed($label)} />
          <TextField
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            selectTextOnFocus
            onBlur={() => {
              if (!amount.trim()) setAmount("0.00")
            }}
            textAlignVertical="center"
            containerStyle={themed($amountInputContainer)}
            inputWrapperStyle={themed($amountInputWrapper)}
            style={themed($amountInput)}
          />
        </View>

        <View style={themed($typeTabs)}>
          {transactionTypes.map((item) => (
            <Pressable
              key={item.value}
              disabled={isEditing}
              onPress={() => setType(item.value)}
              style={themed([
                $typeTab,
                type === item.value && $activeTypeTabs[item.value],
                isEditing && type !== item.value && $disabledTypeTab,
              ])}
            >
              <Text
                text={item.label}
                style={themed([$typeText, type === item.value && $activeTypeText])}
              />
              {isEditing && type === item.value && (
                <MaterialCommunityIcons name="lock" size={12} style={themed($activeTypeText)} />
              )}
            </Pressable>
          ))}
        </View>

        {!!editLoadError && (
          <View style={themed($loadError)}>
            <Text text={editLoadError} style={themed($error)} />
            {transactionDetail.status === "error" && (
              <Button
                text="Retry"
                onPress={() => {
                  if (editParams?.groupId) void loadTransaction(editParams.groupId)
                }}
              />
            )}
          </View>
        )}
        {isLoadingEdit ? (
          <LoadingIndicator label="Loading transaction..." />
        ) : !editLoadError ? (
          <View style={themed($formCard)}>
            <SelectorField
              label="Source Account"
              value={source?.attributes.name}
              placeholder="Select source"
              onPress={() => setSelector("source")}
            />
            <SelectorField
              label="Destination Account"
              value={destination?.attributes.name}
              placeholder="Select destination"
              onPress={() => setSelector("destination")}
            />

            <TextField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Lunch, salary, transfer..."
            />

            <View style={themed($dateRow)}>
              <DateField
                label="Date"
                value={date.toLocaleDateString()}
                icon="calendar-month-outline"
                onPress={() => setDatePickerMode("date")}
              />
              <DateField
                label="Time"
                value={date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                icon="clock-outline"
                onPress={() => setDatePickerMode("time")}
              />
            </View>

            <SelectorField
              label="Category"
              value={categoryName}
              placeholder="Optional category"
              onPress={() => setSelector("category")}
            />
            <TextField
              label="Tags"
              value={tags}
              onChangeText={setTags}
              placeholder="essential, monthly"
              autoCapitalize="none"
            />
            <TextField
              label="Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Describe this transaction..."
              multiline
            />
          </View>
        ) : null}

        {!!(validationError || requestError) && (
          <Text text={validationError ?? requestError?.message} style={themed($error)} />
        )}
      </Screen>

      <DateTimeFieldPicker
        visible={!!datePickerMode}
        value={date}
        mode={datePickerMode ?? "date"}
        maximumDate={datePickerMode === "date" || selectedDateIsToday ? today : undefined}
        onChange={onDateChange}
        onClose={() => setDatePickerMode(undefined)}
      />

      <SelectionSheet
        visible={!!selector}
        title={
          selector === "source"
            ? "Source Account"
            : selector === "destination"
              ? "Destination Account"
              : "Category"
        }
        items={selectorItems}
        selectedIds={
          selector === "source"
            ? sourceId
              ? [sourceId]
              : []
            : selector === "destination"
              ? destinationId
                ? [destinationId]
                : []
              : categories.data
                  .filter((category) => category.attributes.name === categoryName)
                  .map((category) => category.id)
        }
        onSelect={([id]) => {
          if (selector === "source") setSourceId(id)
          else if (selector === "destination") setDestinationId(id)
          else {
            setCategoryName(
              categories.data.find((category) => category.id === id)?.attributes.name ?? "",
            )
          }
        }}
        onClose={() => setSelector(undefined)}
      />
    </>
  )
}

function SelectorField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string
  value?: string
  placeholder: string
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <View>
      <Text text={label} style={themed($fieldLabel)} />
      <Pressable onPress={onPress} style={themed($selectorField)}>
        <Text text={value || placeholder} style={themed(value ? $fieldValue : $placeholder)} />
        <MaterialCommunityIcons name="chevron-down" size={22} style={themed($dimIcon)} />
      </Pressable>
    </View>
  )
}

function DateField({
  label,
  value,
  icon,
  onPress,
}: {
  label: string
  value: string
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($dateField)}>
      <Text text={label} style={themed($fieldLabel)} />
      <Pressable onPress={onPress} style={themed($selectorField)}>
        <Text text={value} style={themed($fieldValue)} numberOfLines={1} />
        <MaterialCommunityIcons name={icon} size={20} style={themed($dimIcon)} />
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

const $amountBlock: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  paddingVertical: 4,
  width: "100%",
})

const $label: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  letterSpacing: 1.5,
})

const $amountInputContainer: ThemedStyle<ViewStyle> = () => ({
  width: "100%",
})

const $amountInputWrapper: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.transparent,
  borderColor: colors.transparent,
  borderWidth: 0,
  minHeight: 68,
  overflow: "visible",
  width: "100%",
})

const $amountInput: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  alignSelf: "stretch",
  color: colors.text,
  fontFamily: typography.primary.normal,
  fontSize: 40,
  height: 64,
  includeFontPadding: false,
  lineHeight: 56,
  marginHorizontal: 0,
  marginVertical: 0,
  paddingHorizontal: 0,
  paddingVertical: 0,
  textAlign: "center",
  width: "100%",
})

const $typeTabs: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 13,
  flexDirection: "row",
  padding: 3,
})

const $typeTab: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  borderRadius: 10,
  flex: 1,
  flexDirection: "row",
  gap: 5,
  justifyContent: "center",
  minHeight: 44,
})

const $activeTypeTabs: Record<TransactionType, ThemedStyle<ViewStyle>> = {
  withdrawal: ({ colors }) => ({ backgroundColor: colors.palette.tertiary300 }),
  deposit: ({ colors }) => ({ backgroundColor: colors.palette.primary300 }),
  transfer: ({ colors }) => ({ backgroundColor: colors.palette.secondary300 }),
}

const $disabledTypeTab: ThemedStyle<ViewStyle> = () => ({ opacity: 0.45 })

const $typeText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 14,
})

const $activeTypeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
})

const $formCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 18,
  gap: spacing.md,
  padding: spacing.md,
})

const $fieldLabel: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  fontSize: 13,
  marginBottom: spacing.xs,
})

const $selectorField: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 12,
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 46,
  paddingHorizontal: spacing.sm,
})

const $fieldValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  flex: 1,
  fontSize: 15,
})

const $placeholder: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  fontSize: 15,
})

const $dimIcon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $dateRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $dateField: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $error: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
  fontSize: 14,
  textAlign: "center",
})

const $loadError: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.md,
  paddingVertical: spacing.lg,
})

const $saveButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary300,
  borderColor: colors.palette.primary300,
  borderRadius: 14,
  minHeight: 50,
})

const $saveText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
})

const $disabledButton: ThemedStyle<ViewStyle> = () => ({ opacity: 0.55 })
