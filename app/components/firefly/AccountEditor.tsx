import { useEffect, useMemo, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { DateTimeFieldPicker } from "@/components/firefly/DateTimeFieldPicker"
import { SelectionItem, SelectionSheet } from "@/components/firefly/SelectionSheet"
import { SettingsEditorModal } from "@/components/settings/SettingsEditorModal"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Switch } from "@/components/Toggle/Switch"
import type {
  AccountRole,
  AccountType,
  CreditCardType,
  FireflyAccount,
  FireflyCurrency,
  InterestPeriod,
  LiabilityDirection,
  LiabilityType,
  StoreAccountRequest,
} from "@/models/firefly"
import { accountWritableType } from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Selector =
  | "type"
  | "currency"
  | "role"
  | "liabilityType"
  | "direction"
  | "interestPeriod"
  | "creditCardType"

const typeItems: SelectionItem[] = [
  { id: "asset", title: "Asset", icon: "bank-outline" },
  { id: "expense", title: "Expense", icon: "cart-outline" },
  { id: "revenue", title: "Revenue", icon: "trending-up" },
  { id: "liability", title: "Liability", icon: "credit-card-outline" },
]

const roleItems: SelectionItem[] = [
  { id: "defaultAsset", title: "Default asset account" },
  { id: "sharedAsset", title: "Shared asset account" },
  { id: "savingAsset", title: "Savings account" },
  { id: "ccAsset", title: "Credit card" },
  { id: "cashWalletAsset", title: "Cash wallet" },
]

const liabilityTypeItems: SelectionItem[] = [
  { id: "loan", title: "Loan" },
  { id: "debt", title: "Debt" },
  { id: "mortgage", title: "Mortgage" },
]

const directionItems: SelectionItem[] = [
  { id: "debit", title: "I owe this debt" },
  { id: "credit", title: "I am owed this debt" },
]

const interestPeriodItems: SelectionItem[] = [
  { id: "daily", title: "Daily" },
  { id: "weekly", title: "Weekly" },
  { id: "monthly", title: "Monthly" },
  { id: "quarterly", title: "Quarterly" },
  { id: "half-year", title: "Half-yearly" },
  { id: "yearly", title: "Yearly" },
]

const creditCardTypeItems: SelectionItem[] = [
  { id: "monthlyFull", title: "Full balance each month" },
]

const labels = new Map(
  [
    ...typeItems,
    ...roleItems,
    ...liabilityTypeItems,
    ...directionItems,
    ...interestPeriodItems,
    ...creditCardTypeItems,
  ].map((item) => [item.id, item.title]),
)

const emptyToNull = (value: string) => value.trim() || null
const validNumber = (value: string) => value.trim() !== "" && Number.isFinite(Number(value))
const dateToApi = (value: Date) => value.toISOString()
const accountRoleFromApi = (value?: string | null): AccountRole =>
  roleItems.some((item) => item.id === value) ? (value as AccountRole) : "defaultAsset"
const dateFromApi = (value?: string | null) => {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export function AccountEditor({
  visible,
  account,
  currencies,
  selectedCurrency,
  saving,
  requestError,
  onClose,
  onSave,
}: {
  visible: boolean
  account?: FireflyAccount | null
  currencies: FireflyCurrency[]
  selectedCurrency?: string
  saving?: boolean
  requestError?: string
  onClose: () => void
  onSave: (
    request: StoreAccountRequest,
    id?: string,
    keepOpenOnSuccess?: boolean,
  ) => Promise<boolean>
}) {
  const { themed } = useAppTheme()
  const [selector, setSelector] = useState<Selector>()
  const [dateField, setDateField] = useState<"opening" | "payment">()
  const [validationError, setValidationError] = useState<string>()
  const [type, setType] = useState<AccountType>("asset")
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [openingBalance, setOpeningBalance] = useState("")
  const [openingDate, setOpeningDate] = useState<Date>()
  const [role, setRole] = useState<AccountRole>("defaultAsset")
  const [virtualBalance, setVirtualBalance] = useState("")
  const [includeNetWorth, setIncludeNetWorth] = useState(true)
  const [notes, setNotes] = useState("")
  const [active, setActive] = useState(true)
  const [liabilityType, setLiabilityType] = useState<LiabilityType>("loan")
  const [liabilityDirection, setLiabilityDirection] = useState<LiabilityDirection>("debit")
  const [interest, setInterest] = useState("0")
  const [interestPeriod, setInterestPeriod] = useState<InterestPeriod>("monthly")
  const [creditCardType, setCreditCardType] = useState<CreditCardType>("monthlyFull")
  const [paymentDate, setPaymentDate] = useState<Date>()

  const defaultCurrency =
    currencies.find((item) => item.attributes.primary)?.attributes.code ??
    selectedCurrency ??
    currencies[0]?.attributes.code ??
    ""

  function resetCreateForm(accountType: AccountType) {
    setName("")
    setCurrency(accountType === "asset" || accountType === "liability" ? defaultCurrency : "")
    setAccountNumber("")
    setOpeningBalance("")
    setOpeningDate(undefined)
    setRole("defaultAsset")
    setVirtualBalance("")
    setIncludeNetWorth(true)
    setNotes("")
    setActive(true)
    setLiabilityType("loan")
    setLiabilityDirection("debit")
    setInterest("0")
    setInterestPeriod("monthly")
    setCreditCardType("monthlyFull")
    setPaymentDate(undefined)
    setValidationError(undefined)
    setSelector(undefined)
    setDateField(undefined)
  }

  useEffect(() => {
    if (!visible) return
    const attributes = account?.attributes
    setType(account ? (accountWritableType(account) as AccountType) : "asset")
    setName(attributes?.name ?? "")
    setCurrency(attributes?.currency_code ?? defaultCurrency)
    setAccountNumber(attributes?.account_number ?? "")
    setOpeningBalance(attributes?.opening_balance ?? "")
    setOpeningDate(
      attributes?.opening_balance_date ? dateFromApi(attributes.opening_balance_date) : undefined,
    )
    setRole(accountRoleFromApi(attributes?.account_role))
    setVirtualBalance(attributes?.virtual_balance ?? "")
    setIncludeNetWorth(attributes?.include_net_worth !== false)
    setNotes(attributes?.notes ?? "")
    setActive(attributes?.active !== false)
    setLiabilityType(attributes?.liability_type ?? "loan")
    setLiabilityDirection(attributes?.liability_direction ?? "debit")
    setInterest(attributes?.interest ?? "0")
    setInterestPeriod(attributes?.interest_period ?? "monthly")
    setCreditCardType(attributes?.credit_card_type ?? "monthlyFull")
    setPaymentDate(
      attributes?.monthly_payment_date ? dateFromApi(attributes.monthly_payment_date) : undefined,
    )
    setValidationError(undefined)
    setSelector(undefined)
    setDateField(undefined)
  }, [account, defaultCurrency, visible])

  const currencyItems = useMemo(
    () =>
      currencies.map((item) => ({
        id: item.attributes.code,
        title: `${item.attributes.code} - ${item.attributes.name}`,
        subtitle: item.attributes.primary ? "Primary currency" : item.attributes.symbol,
      })),
    [currencies],
  )

  const selectorConfig = {
    type: { title: "Account Type", items: typeItems, selected: type },
    currency: { title: "Currency", items: currencyItems, selected: currency },
    role: { title: "Account Role", items: roleItems, selected: role },
    liabilityType: {
      title: "Liability Type",
      items: liabilityTypeItems,
      selected: liabilityType,
    },
    direction: { title: "Direction", items: directionItems, selected: liabilityDirection },
    interestPeriod: {
      title: "Interest Period",
      items: interestPeriodItems,
      selected: interestPeriod,
    },
    creditCardType: {
      title: "Credit-card Payment Type",
      items: creditCardTypeItems,
      selected: creditCardType,
    },
  } satisfies Record<Selector, { title: string; items: SelectionItem[]; selected: string }>

  function applySelection(ids: string[]) {
    const value = ids[0]
    if (!value || !selector) return
    if (selector === "type") setType(value as AccountType)
    if (selector === "currency") setCurrency(value)
    if (selector === "role") setRole(value as AccountRole)
    if (selector === "liabilityType") setLiabilityType(value as LiabilityType)
    if (selector === "direction") setLiabilityDirection(value as LiabilityDirection)
    if (selector === "interestPeriod") setInterestPeriod(value as InterestPeriod)
    if (selector === "creditCardType") setCreditCardType(value as CreditCardType)
  }

  function buildRequest(): StoreAccountRequest | undefined {
    if (!name.trim()) {
      setValidationError("Name is required.")
      return
    }
    if ((type === "asset" || type === "liability") && !currency) {
      setValidationError("Currency is required.")
      return
    }
    if (type === "asset") {
      if (!!openingBalance.trim() !== !!openingDate) {
        setValidationError("Opening balance and opening date must be provided together.")
        return
      }
      if (openingBalance.trim() && !validNumber(openingBalance)) {
        setValidationError("Opening balance must be a valid number.")
        return
      }
      if (virtualBalance.trim() && !validNumber(virtualBalance)) {
        setValidationError("Virtual balance must be a valid number.")
        return
      }
      if (role === "ccAsset" && (!creditCardType || !paymentDate)) {
        setValidationError("Credit-card payment type and monthly payment date are required.")
        return
      }
      return {
        name: name.trim(),
        type,
        currency_code: currency,
        active,
        account_number: emptyToNull(accountNumber),
        opening_balance: emptyToNull(openingBalance),
        opening_balance_date: openingDate ? dateToApi(openingDate) : null,
        account_role: role,
        virtual_balance: emptyToNull(virtualBalance),
        include_net_worth: includeNetWorth,
        notes: emptyToNull(notes),
        credit_card_type: role === "ccAsset" ? creditCardType : null,
        monthly_payment_date: role === "ccAsset" && paymentDate ? dateToApi(paymentDate) : null,
      }
    }
    if (type === "expense" || type === "revenue") {
      return {
        name: name.trim(),
        type,
        active,
        account_number: emptyToNull(accountNumber),
        notes: emptyToNull(notes),
      }
    }
    if (!validNumber(openingBalance)) {
      setValidationError("Debt start amount must be a valid number.")
      return
    }
    if (!openingDate) {
      setValidationError("Debt start date is required.")
      return
    }
    if (!validNumber(interest)) {
      setValidationError("Interest percentage must be a valid number.")
      return
    }
    return {
      name: name.trim(),
      type,
      currency_code: currency,
      active,
      opening_balance: openingBalance.trim(),
      opening_balance_date: dateToApi(openingDate),
      liability_type: liabilityType,
      liability_direction: liabilityDirection,
      interest: interest.trim(),
      interest_period: interestPeriod,
    }
  }

  async function save(addAnother = false) {
    setValidationError(undefined)
    const request = buildRequest()
    if (!request) return
    const saved = addAnother
      ? await onSave(request, account?.id, true)
      : await onSave(request, account?.id)
    if (saved && addAnother) resetCreateForm(type)
  }

  const selectedConfig = selector ? selectorConfig[selector] : undefined
  const selectedDate = dateField === "payment" ? paymentDate : openingDate

  return (
    <>
      <SettingsEditorModal
        visible={visible}
        title={account ? "Edit Account" : "New Account"}
        saving={saving}
        canSave={!!name.trim()}
        secondarySaveLabel={account ? undefined : "Save and Add Another"}
        onClose={onClose}
        onSave={() => void save()}
        onSecondarySave={account ? undefined : () => void save(true)}
      >
        {account ? (
          <View style={themed($lockedType)}>
            <Text text="Account Type" style={themed($fieldLabel)} />
            <Text text={labels.get(type) ?? type} style={themed($lockedValue)} />
          </View>
        ) : (
          <SelectorField
            label="Account Type"
            value={labels.get(type)}
            onPress={() => setSelector("type")}
          />
        )}
        <TextField
          accessibilityLabel="Account name"
          label="Name"
          value={name}
          onChangeText={setName}
          inputWrapperStyle={themed($inputWrapper)}
          style={themed($inputText)}
        />

        {(type === "asset" || type === "liability") && (
          <SelectorField
            label="Currency"
            value={currency}
            placeholder="Select currency"
            onPress={() => setSelector("currency")}
          />
        )}

        {(type === "asset" || type === "expense" || type === "revenue") && (
          <TextField
            accessibilityLabel="Account number"
            label="Account Number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="Optional"
            inputWrapperStyle={themed($inputWrapper)}
            style={themed($inputText)}
          />
        )}

        {type === "asset" && (
          <>
            <TextField
              accessibilityLabel="Opening balance"
              label="Opening Balance"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
              placeholder="Optional"
              inputWrapperStyle={themed($inputWrapper)}
              style={themed($inputText)}
            />
            <DateField
              label="Opening Date"
              date={openingDate}
              optional
              onPress={() => setDateField("opening")}
              onClear={() => setOpeningDate(undefined)}
            />
            <SelectorField
              label="Account Role"
              value={labels.get(role)}
              onPress={() => setSelector("role")}
            />
            {role === "ccAsset" && (
              <>
                <SelectorField
                  label="Credit-card Payment Type"
                  value={labels.get(creditCardType)}
                  onPress={() => setSelector("creditCardType")}
                />
                <DateField
                  label="Monthly Payment Date"
                  date={paymentDate}
                  onPress={() => setDateField("payment")}
                />
              </>
            )}
            <TextField
              accessibilityLabel="Virtual balance"
              label="Virtual Balance"
              value={virtualBalance}
              onChangeText={setVirtualBalance}
              keyboardType="decimal-pad"
              placeholder="Optional"
              inputWrapperStyle={themed($inputWrapper)}
              style={themed($inputText)}
            />
            <Switch
              label="Include in net worth"
              value={includeNetWorth}
              onValueChange={setIncludeNetWorth}
            />
            <TextField
              accessibilityLabel="Notes"
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              inputWrapperStyle={themed($inputWrapper)}
              style={themed($inputText)}
            />
          </>
        )}

        {(type === "expense" || type === "revenue") && (
          <TextField
            accessibilityLabel="Notes"
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            inputWrapperStyle={themed($inputWrapper)}
            style={themed($inputText)}
          />
        )}

        {type === "liability" && (
          <>
            <SelectorField
              label="Liability Type"
              value={labels.get(liabilityType)}
              onPress={() => setSelector("liabilityType")}
            />
            <TextField
              accessibilityLabel="Debt start amount"
              label="Debt Start Amount"
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
              inputWrapperStyle={themed($inputWrapper)}
              style={themed($inputText)}
            />
            <DateField
              label="Debt Start Date"
              date={openingDate}
              onPress={() => setDateField("opening")}
            />
            <SelectorField
              label="Direction"
              value={labels.get(liabilityDirection)}
              onPress={() => setSelector("direction")}
            />
            <TextField
              accessibilityLabel="Interest percentage"
              label="Interest Percentage"
              value={interest}
              onChangeText={setInterest}
              keyboardType="decimal-pad"
              inputWrapperStyle={themed($inputWrapper)}
              style={themed($inputText)}
            />
            <SelectorField
              label="Interest Period"
              value={labels.get(interestPeriod)}
              onPress={() => setSelector("interestPeriod")}
            />
          </>
        )}

        {!!account && type !== "liability" && (
          <Switch label="Active" value={active} onValueChange={setActive} />
        )}

        {!!(validationError || requestError) && (
          <Text text={validationError ?? requestError} style={themed($error)} />
        )}
      </SettingsEditorModal>

      <DateTimeFieldPicker
        visible={!!dateField}
        value={selectedDate ?? new Date()}
        mode="date"
        onChange={(value) => {
          if (dateField === "payment") setPaymentDate(value)
          else setOpeningDate(value)
        }}
        onClose={() => setDateField(undefined)}
      />

      <SelectionSheet
        visible={!!selector}
        title={selectedConfig?.title ?? "Select"}
        items={selectedConfig?.items ?? []}
        selectedIds={selectedConfig ? [selectedConfig.selected] : []}
        onSelect={applySelection}
        onClose={() => setSelector(undefined)}
      />
    </>
  )
}

function SelectorField({
  label,
  value,
  placeholder = "Select",
  onPress,
}: {
  label: string
  value?: string
  placeholder?: string
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
        <Text text={value || placeholder} style={themed(value ? $selectorValue : $placeholder)} />
        <MaterialCommunityIcons name="chevron-down" color={colors.textDim} size={20} />
      </Pressable>
    </View>
  )
}

function DateField({
  label,
  date,
  optional,
  onPress,
  onClear,
}: {
  label: string
  date?: Date
  optional?: boolean
  onPress: () => void
  onClear?: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  return (
    <View>
      <Text text={label} style={themed($fieldLabel)} />
      <View style={themed($dateRow)}>
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          onPress={onPress}
          style={themed($dateField)}
        >
          <Text
            text={date ? date.toLocaleDateString() : optional ? "Optional" : "Select date"}
            style={themed(date ? $selectorValue : $placeholder)}
          />
          <MaterialCommunityIcons name="calendar-month-outline" color={colors.textDim} size={20} />
        </Pressable>
        {!!date && !!onClear && (
          <Pressable accessibilityLabel={`Clear ${label}`} onPress={onClear} style={themed($clear)}>
            <MaterialCommunityIcons name="close" color={colors.textDim} size={18} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

const $fieldLabel: ThemedStyle<TextStyle> = ({ colors, spacing, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 13,
  marginBottom: spacing.xxs,
})
const $selectorField: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  borderWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 46,
  paddingHorizontal: spacing.sm,
})
const $selectorValue: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text, flex: 1 })
const $placeholder: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim, flex: 1 })
const $lockedType: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 8,
  padding: spacing.sm,
})
const $lockedValue: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})
const $dateRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
})
const $dateField: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  borderWidth: 1,
  flex: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 46,
  paddingHorizontal: spacing.sm,
})
const $clear: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 20,
  height: 40,
  justifyContent: "center",
  width: 40,
})
const $error: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.error })
const $inputWrapper: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  minHeight: 46,
})
const $inputText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 15,
})
