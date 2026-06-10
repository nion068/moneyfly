import { FC, useEffect, useRef, useState } from "react"
import { Modal, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button } from "@/components/Button"
import { DateTimeFieldPicker } from "@/components/firefly/DateTimeFieldPicker"
import {
  Chip,
  FinanceCard,
  MetricPill,
  ProgressBar,
  SectionHeader,
} from "@/components/firefly/FinancePrimitives"
import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { SelectionItem, SelectionSheet } from "@/components/firefly/SelectionSheet"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import { FlatTransaction } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import {
  buildMonthlySummary,
  filterTransactions,
  formatDateKey,
  formatMoney,
  getTransactionIconName,
  getMonthRange,
  groupTransactionsByDate,
  isOwnedAccount,
  maskMoney,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDisplayNumber } from "@/utils/numbers"

type HomeScreenProps = MainTabScreenProps<"Home">
type TypeFilter = "All" | "Expenses" | "Income" | "Transfers"
type StructuredFilters = {
  categoryNames: string[]
  accountIds: string[]
  startDate?: string
  endDate?: string
}

const typeFilters: TypeFilter[] = ["All", "Expenses", "Income", "Transfers"]
const emptyStructuredFilters: StructuredFilters = { categoryNames: [], accountIds: [] }
const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Date(2020, month, 1).toLocaleDateString("en-US", { month: "short" }),
)

export const HomeScreen: FC<HomeScreenProps> = ({ navigation }) => {
  const { themed } = useAppTheme()
  const {
    hideAmounts,
    toggleHideAmounts,
    selectedMonth,
    setSelectedMonth,
    transactions,
    accounts,
    categories,
    selectedCurrency,
    summariesByCurrency,
    refresh,
    isRefreshing,
    isMonthLoading,
  } = useFirefly()
  const [activeType, setActiveType] = useState<TypeFilter>("All")
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<StructuredFilters>(emptyStructuredFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [showYears, setShowYears] = useState(false)
  const monthScrollRef = useRef<ScrollView>(null)
  const now = new Date()
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const effectiveCurrency = selectedCurrency ?? summariesByCurrency[0]?.currencyCode
  const ownedAccounts = accounts.data.filter(isOwnedAccount)

  useEffect(() => {
    const timeout = setTimeout(() => {
      monthScrollRef.current?.scrollTo({
        x: Math.max(0, selectedMonth.getMonth() * 66 - 120),
        animated: true,
      })
    }, 50)
    return () => clearTimeout(timeout)
  }, [selectedMonth])

  useEffect(() => {
    const { start, end } = getMonthRange(selectedMonth)
    const maximum = end < formatDateKey(new Date()) ? end : formatDateKey(new Date())
    setFilters((current) => ({
      ...current,
      startDate:
        current.startDate && current.startDate >= start && current.startDate <= maximum
          ? current.startDate
          : undefined,
      endDate:
        current.endDate && current.endDate >= start && current.endDate <= maximum
          ? current.endDate
          : undefined,
    }))
  }, [selectedMonth])

  const currencyTransactions = transactions.data.filter(
    (transaction) => !effectiveCurrency || transaction.currencyCode === effectiveCurrency,
  )
  const selectedAccounts = ownedAccounts.filter((account) =>
    filters.accountIds.includes(account.id),
  )
  const filteredTransactions = filterTransactions(currencyTransactions, {
    type:
      activeType === "Expenses"
        ? "withdrawal"
        : activeType === "Income"
          ? "deposit"
          : activeType === "Transfers"
            ? "transfer"
            : "all",
    search,
    categoryNames: filters.categoryNames,
    accounts: selectedAccounts,
    startDate: filters.startDate,
    endDate: filters.endDate,
  }).sort((left, right) => right.date.localeCompare(left.date))
  const groupedTransactions = groupTransactionsByDate(filteredTransactions)
  const summary =
    summariesByCurrency.find((item) => item.currencyCode === effectiveCurrency) ??
    buildMonthlySummary([])
  const activeFilterCount =
    filters.categoryNames.length +
    filters.accountIds.length +
    Number(!!filters.startDate) +
    Number(!!filters.endDate)
  const amount = (value: number) =>
    hideAmounts ? maskMoney(summary.currencySymbol) : formatMoney(value, summary.currencySymbol)

  return (
    <>
      <Screen
        preset="scroll"
        safeAreaEdges={["top"]}
        contentContainerStyle={themed([$container, isMonthLoading && $loadingContainer])}
        ScrollViewProps={{ keyboardShouldPersistTaps: "handled" }}
      >
        <View style={themed($topBar)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select year"
            onPress={() => setShowYears(true)}
            style={themed($yearButton)}
          >
            <Text text={String(selectedMonth.getFullYear())} style={themed($year)} />
            <MaterialCommunityIcons name="chevron-down" size={22} style={themed($dimIcon)} />
          </Pressable>
          <ScrollView
            ref={monthScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={themed($monthScroller)}
            contentContainerStyle={themed($months)}
          >
            {monthNames.map((label, monthIndex) => {
              const month = new Date(selectedMonth.getFullYear(), monthIndex, 1)
              const disabled = month > currentMonth
              const active = monthIndex === selectedMonth.getMonth()
              return (
                <Pressable
                  key={label}
                  disabled={disabled}
                  onPress={() => setSelectedMonth(month)}
                  style={themed([$monthChip, active && $activeMonthChip])}
                >
                  <Text
                    text={label}
                    style={themed([
                      $monthText,
                      active && $activeMonthText,
                      disabled && $disabledMonthText,
                    ])}
                  />
                </Pressable>
              )
            })}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hideAmounts ? "Show summary amounts" : "Hide summary amounts"}
            accessibilityState={{ checked: hideAmounts }}
            onPress={toggleHideAmounts}
            style={themed($eyeButton)}
          >
            <MaterialCommunityIcons
              name={hideAmounts ? "eye-off-outline" : "eye-outline"}
              size={22}
              style={themed($icon)}
            />
          </Pressable>
        </View>

        {isMonthLoading ? (
          <View style={themed($monthLoading)}>
            <LoadingIndicator label="Loading month..." />
          </View>
        ) : (
          <>
            {isRefreshing && <LoadingIndicator label="Refreshing..." compact />}
            {transactions.status === "loading" && transactions.data.length === 0 && (
              <LoadingIndicator label="Loading transactions..." compact />
            )}

            <FinanceCard style={themed($summaryCard)}>
              <Text
                text={`CASH FLOW · ${selectedMonth
                  .toLocaleDateString("en-US", { month: "long" })
                  .toUpperCase()}`}
                style={themed($eyebrow)}
              />
              <Text text={amount(summary.netBalance)} style={themed($heroAmount)} />
              <View style={themed($metricRow)}>
                <MetricPill
                  label="Income"
                  value={amount(summary.totalIncome)}
                  tone="income"
                  icon="↙"
                  centered
                  dense
                />
                <MetricPill
                  label="Expenses"
                  value={amount(summary.totalExpense)}
                  tone="expense"
                  icon="↗"
                  centered
                  dense
                />
              </View>
              <View style={themed($savingsHeader)}>
                <Text text="Savings rate" style={themed($muted)} />
                <Text
                  text={hideAmounts ? "•••" : `${formatDisplayNumber(summary.savingsRate)}%`}
                  style={themed($savedPercent)}
                />
              </View>
              {hideAmounts ? (
                <View style={themed($maskedProgress)} />
              ) : (
                <ProgressBar value={summary.savingsRate} color="#86cdea" />
              )}
            </FinanceCard>

            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder="Search transactions..."
              inputWrapperStyle={themed($searchField)}
            />

            <View style={themed($filterToolbar)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={themed($typeFilters)}
              >
                {typeFilters.map((filter) => (
                  <Chip
                    key={filter}
                    label={filter}
                    active={activeType === filter}
                    onPress={() => setActiveType(filter)}
                  />
                ))}
              </ScrollView>
              <Pressable onPress={() => setShowFilters(true)} style={themed($filterButton)}>
                <MaterialCommunityIcons name="tune-variant" size={19} style={themed($icon)} />
                {activeFilterCount > 0 && (
                  <View style={themed($filterBadge)}>
                    <Text text={String(activeFilterCount)} style={themed($filterBadgeText)} />
                  </View>
                )}
              </Pressable>
            </View>

            <SectionHeader title="Transactions" />
            {transactions.status === "error" && (
              <Pressable onPress={() => void refresh()}>
                <Text
                  text={`${transactions.error?.message} Tap to retry.`}
                  style={themed($expenseText)}
                />
              </Pressable>
            )}
            {transactions.status !== "loading" && filteredTransactions.length === 0 && (
              <Text text="No transactions match this month and filter." style={themed($muted)} />
            )}
            {Object.entries(groupedTransactions)
              .sort(([left], [right]) => right.localeCompare(left))
              .map(([date, items]) => (
                <TransactionGroup
                  key={date}
                  title={new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  transactions={items}
                  onPress={(transaction) =>
                    navigation.navigate("TransactionDetails", {
                      transaction,
                    })
                  }
                />
              ))}
          </>
        )}
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add manual transaction"
        onPress={() => navigation.navigate("AddTransaction")}
        style={themed($floatingAdd)}
      >
        <MaterialCommunityIcons name="plus" size={30} style={themed($floatingAddIcon)} />
      </Pressable>

      <YearPicker
        visible={showYears}
        selectedYear={selectedMonth.getFullYear()}
        maximumYear={now.getFullYear()}
        onSelect={(year) => {
          const monthIndex =
            year === now.getFullYear()
              ? Math.min(selectedMonth.getMonth(), now.getMonth())
              : selectedMonth.getMonth()
          setSelectedMonth(new Date(year, monthIndex, 1))
          setShowYears(false)
        }}
        onClose={() => setShowYears(false)}
      />
      <TransactionFilterSheet
        visible={showFilters}
        value={filters}
        selectedMonth={selectedMonth}
        categories={categories.data.map((category) => ({
          id: category.id,
          title: category.attributes.name,
          icon: "shape-outline",
        }))}
        accounts={ownedAccounts.map((account) => ({
          id: account.id,
          title: account.attributes.name,
          subtitle: account.attributes.type,
          icon: "wallet-outline",
        }))}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />
    </>
  )
}

function TransactionGroup({
  title,
  transactions,
  onPress,
}: {
  title: string
  transactions: FlatTransaction[]
  onPress: (transaction: FlatTransaction) => void
}) {
  const { themed } = useAppTheme()
  const summary = buildMonthlySummary(transactions)

  return (
    <View style={themed($group)}>
      <View style={themed($groupHeader)}>
        <Text text={title} style={themed($groupTitle)} />
        <Text
          text={formatMoney(summary.netBalance, summary.currencySymbol)}
          style={themed($groupNet)}
        />
      </View>
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.journalId ?? `${transaction.groupId}-${transaction.date}`}
          transaction={transaction}
          onPress={() => onPress(transaction)}
        />
      ))}
    </View>
  )
}

function TransactionRow({
  transaction,
  onPress,
}: {
  transaction: FlatTransaction
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  const isIncome = transaction.type === "deposit"
  const isTransfer = transaction.type === "transfer"

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${transaction.description}`}
      onPress={onPress}
      style={themed($transactionRow)}
    >
      <View style={themed([$categoryIcon, isIncome && $incomeIcon, isTransfer && $transferIcon])}>
        <MaterialCommunityIcons
          name={getTransactionIconName(transaction) as keyof typeof MaterialCommunityIcons.glyphMap}
          size={20}
          style={themed($icon)}
        />
      </View>
      <View style={themed($transactionMain)}>
        <Text text={transaction.description} style={themed($transactionTitle)} />
        <Text
          text={`${transaction.categoryName ?? (isTransfer ? "Transfer" : "General")} · ${
            transaction.sourceName
          } · ${new Date(transaction.date).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}`}
          style={themed($muted)}
          numberOfLines={1}
        />
        {transaction.tags.length > 0 && (
          <View style={themed($tagRow)}>
            {transaction.tags.slice(0, 2).map((tag) => (
              <View key={tag} style={themed($tag)}>
                <Text text={`#${tag}`} style={themed($tagText)} />
              </View>
            ))}
          </View>
        )}
      </View>
      <Text
        text={`${isIncome ? "+" : transaction.type === "withdrawal" ? "-" : ""}${formatMoney(
          transaction.amount,
          transaction.currencySymbol,
        )}`}
        style={themed([
          $transactionAmount,
          isIncome ? $incomeText : isTransfer ? $transferText : $expenseText,
        ])}
      />
    </Pressable>
  )
}

function YearPicker({
  visible,
  selectedYear,
  maximumYear,
  onSelect,
  onClose,
}: {
  visible: boolean
  selectedYear: number
  maximumYear: number
  onSelect: (year: number) => void
  onClose: () => void
}) {
  const { themed } = useAppTheme()
  const [decadeStart, setDecadeStart] = useState(Math.floor(selectedYear / 10) * 10)
  useEffect(() => setDecadeStart(Math.floor(selectedYear / 10) * 10), [selectedYear, visible])
  const years = Array.from({ length: 12 }, (_, index) => decadeStart - 1 + index)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={themed($modalOverlay)}>
        <Pressable style={themed($modalDismiss)} onPress={onClose} />
        <View style={themed($yearModal)}>
          <View style={themed($yearModalHeader)}>
            <Pressable onPress={() => setDecadeStart((year) => year - 10)} style={themed($iconTap)}>
              <MaterialCommunityIcons name="chevron-left" size={26} style={themed($icon)} />
            </Pressable>
            <Text text={`${decadeStart}–${decadeStart + 9}`} style={themed($yearModalTitle)} />
            <Pressable
              disabled={decadeStart + 10 > maximumYear}
              onPress={() => setDecadeStart((year) => year + 10)}
              style={themed($iconTap)}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={26}
                style={themed(decadeStart + 10 > maximumYear ? $disabledIcon : $icon)}
              />
            </Pressable>
          </View>
          <View style={themed($yearGrid)}>
            {years.map((year) => {
              const disabled = year > maximumYear
              return (
                <Pressable
                  key={year}
                  disabled={disabled}
                  onPress={() => onSelect(year)}
                  style={themed([$yearCell, year === selectedYear && $selectedYearCell])}
                >
                  <Text
                    text={String(year)}
                    style={themed([
                      $yearCellText,
                      year === selectedYear && $selectedYearText,
                      disabled && $disabledMonthText,
                    ])}
                  />
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
    </Modal>
  )
}

function TransactionFilterSheet({
  visible,
  value,
  selectedMonth,
  categories,
  accounts,
  onApply,
  onClose,
}: {
  visible: boolean
  value: StructuredFilters
  selectedMonth: Date
  categories: SelectionItem[]
  accounts: SelectionItem[]
  onApply: (value: StructuredFilters) => void
  onClose: () => void
}) {
  const { themed } = useAppTheme()
  const [draft, setDraft] = useState(value)
  const [selector, setSelector] = useState<"categories" | "accounts">()
  const [dateField, setDateField] = useState<"startDate" | "endDate">()
  useEffect(() => setDraft(value), [value, visible])
  const { start, end } = getMonthRange(selectedMonth)
  const today = formatDateKey(new Date())
  const maximumDate = new Date(`${end < today ? end : today}T12:00:00`)
  const minimumDate = new Date(`${start}T12:00:00`)
  const selectedCategoryIds = categories
    .filter((category) => draft.categoryNames.includes(category.title))
    .map((category) => category.id)

  const setDate = (date: Date) => {
    if (!dateField) return
    const formatted = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-")
    setDraft((current) => {
      if (dateField === "startDate" && current.endDate && formatted > current.endDate) {
        return { ...current, startDate: formatted, endDate: formatted }
      }
      if (dateField === "endDate" && current.startDate && formatted < current.startDate) {
        return { ...current, startDate: formatted, endDate: formatted }
      }
      return { ...current, [dateField]: formatted }
    })
  }

  return (
    <>
      <Modal
        visible={visible && !selector && !dateField}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={themed($modalOverlay)}>
          <Pressable style={themed($modalDismiss)} onPress={onClose} />
          <View style={themed($filterSheet)}>
            <View style={themed($handle)} />
            <View style={themed($filterHeader)}>
              <Text text="Filter Transactions" style={themed($filterTitle)} />
              <Pressable onPress={onClose} style={themed($iconTap)}>
                <MaterialCommunityIcons name="close" size={24} style={themed($icon)} />
              </Pressable>
            </View>
            <FilterField
              label="Categories"
              value={
                draft.categoryNames.length > 0
                  ? `${draft.categoryNames.length} selected`
                  : "All categories"
              }
              onPress={() => setSelector("categories")}
            />
            <FilterField
              label="Accounts"
              value={
                draft.accountIds.length > 0 ? `${draft.accountIds.length} selected` : "All accounts"
              }
              onPress={() => setSelector("accounts")}
            />
            <View style={themed($dateFilterRow)}>
              <FilterField
                label="From"
                value={draft.startDate ?? "Month start"}
                onPress={() => setDateField("startDate")}
                style={themed($dateFilter)}
              />
              <FilterField
                label="To"
                value={draft.endDate ?? (end < today ? end : today)}
                onPress={() => setDateField("endDate")}
                style={themed($dateFilter)}
              />
            </View>
            <View style={themed($filterActions)}>
              <Button
                text="Clear All"
                onPress={() => setDraft(emptyStructuredFilters)}
                style={themed($clearButton)}
                textStyle={themed($clearButtonText)}
              />
              <Button
                text="Apply"
                onPress={() => {
                  onApply(draft)
                  onClose()
                }}
                style={themed($applyButton)}
                textStyle={themed($applyButtonText)}
              />
            </View>
          </View>
        </View>
      </Modal>
      <DateTimeFieldPicker
        visible={!!dateField}
        value={
          new Date(
            `${draft[dateField ?? "startDate"] ?? (dateField === "endDate" ? end : start)}T12:00:00`,
          )
        }
        mode="date"
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={setDate}
        onClose={() => setDateField(undefined)}
      />
      <SelectionSheet
        visible={!!selector}
        title={selector === "categories" ? "Categories" : "Accounts"}
        items={selector === "categories" ? categories : accounts}
        selectedIds={selector === "categories" ? selectedCategoryIds : draft.accountIds}
        multiple
        onSelect={(ids) => {
          if (selector === "categories") {
            setDraft((current) => ({
              ...current,
              categoryNames: categories
                .filter((category) => ids.includes(category.id))
                .map((category) => category.title),
            }))
          } else {
            setDraft((current) => ({ ...current, accountIds: ids }))
          }
        }}
        onClose={() => setSelector(undefined)}
      />
    </>
  )
}

function FilterField({
  label,
  value,
  onPress,
  style,
}: {
  label: string
  value: string
  onPress: () => void
  style?: ViewStyle
}) {
  const { themed } = useAppTheme()
  return (
    <View style={style}>
      <Text text={label} style={themed($filterFieldLabel)} />
      <Pressable onPress={onPress} style={themed($filterField)}>
        <Text text={value} style={themed($filterFieldValue)} numberOfLines={1} />
        <MaterialCommunityIcons name="chevron-down" size={20} style={themed($dimIcon)} />
      </Pressable>
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: 124,
})

const $monthLoading: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
})

const $loadingContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: spacing.md,
})

const $topBar: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  gap: 8,
})

const $yearButton: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  minHeight: 44,
})

const $monthScroller: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $year: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 24,
})

const $dimIcon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
const $icon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })

const $eyeButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 22,
  height: 44,
  justifyContent: "center",
  width: 44,
})

const $months: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  paddingHorizontal: spacing.xxs,
})

const $monthChip: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  borderColor: colors.palette.stroke,
  borderRadius: 22,
  borderWidth: 1,
  justifyContent: "center",
  minHeight: 44,
  width: 58,
})

const $activeMonthChip: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
})

const $monthText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 13,
})

const $activeMonthText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
})

const $disabledMonthText: ThemedStyle<TextStyle> = () => ({ opacity: 0.3 })

const $summaryCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderRadius: 24,
  padding: spacing.sm,
})

const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 11,
  letterSpacing: 1.7,
})

const $heroAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 34,
  lineHeight: 40,
  marginTop: 2,
})

const $metricRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  marginTop: spacing.sm,
})

const $savingsHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: spacing.sm,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
  lineHeight: 18,
})

const $savedPercent: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.secondary300,
  fontFamily: typography.primary.semiBold,
})

const $maskedProgress: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHighest,
  borderRadius: 999,
  height: 8,
})

const $searchField: ThemedStyle<ViewStyle> = () => ({ minHeight: 44 })

const $filterToolbar: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
})

const $typeFilters: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  paddingRight: spacing.xs,
})

const $filterButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 22,
  borderWidth: 1,
  height: 44,
  justifyContent: "center",
  width: 44,
})

const $filterBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.tint,
  borderRadius: 9,
  height: 18,
  justifyContent: "center",
  position: "absolute",
  right: -3,
  top: -3,
  width: 18,
})

const $filterBadgeText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
  fontSize: 10,
})

const $group: ThemedStyle<ViewStyle> = ({ spacing }) => ({ gap: spacing.sm })

const $groupHeader: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  paddingBottom: spacing.xs,
})

const $groupTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.semiBold,
  fontSize: 12,
  letterSpacing: 1,
})

const $groupNet: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
})

const $transactionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 52,
})

const $categoryIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "rgba(216, 113, 98, 0.24)",
  borderRadius: 22,
  height: 44,
  justifyContent: "center",
  width: 44,
})

const $incomeIcon: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "rgba(62, 165, 118, 0.25)",
})

const $transferIcon: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "rgba(134, 205, 234, 0.2)",
})

const $transactionMain: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $transactionTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})

const $tagRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xxs,
  marginTop: spacing.xxs,
})

const $tag: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 10,
  paddingHorizontal: 8,
  paddingVertical: 1,
})

const $tagText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 10,
})

const $transactionAmount: ThemedStyle<TextStyle> = ({ typography }) => ({
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
})

const $incomeText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint })
const $expenseText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
})
const $transferText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.secondary300,
})

const $floatingAdd: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.primary300,
  borderRadius: 28,
  bottom: 12,
  elevation: 8,
  height: 56,
  justifyContent: "center",
  position: "absolute",
  right: 20,
  shadowColor: colors.tint,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  width: 56,
})

const $floatingAddIcon: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.surfaceDim,
})

const $modalOverlay: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.overlay50,
  flex: 1,
  justifyContent: "flex-end",
})

const $modalDismiss: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $yearModal: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignSelf: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 24,
  bottom: "28%",
  padding: spacing.md,
  position: "absolute",
  width: "88%",
})

const $yearModalHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $iconTap: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  height: 44,
  justifyContent: "center",
  width: 44,
})

const $disabledIcon: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  opacity: 0.3,
})

const $yearModalTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 18,
})

const $yearGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
  justifyContent: "center",
  marginTop: spacing.sm,
})

const $yearCell: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  borderRadius: 12,
  justifyContent: "center",
  minHeight: 44,
  width: "29%",
})

const $selectedYearCell: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
})

const $yearCellText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 14,
})

const $selectedYearText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
})

const $filterSheet: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: spacing.xl,
})

const $handle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignSelf: "center",
  backgroundColor: colors.palette.neutral600,
  borderRadius: 3,
  height: 5,
  width: 44,
})

const $filterHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $filterTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 20,
})

const $filterFieldLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  marginBottom: 6,
})

const $filterField: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 12,
  flexDirection: "row",
  minHeight: 46,
  paddingHorizontal: spacing.sm,
})

const $filterFieldValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  flex: 1,
  fontSize: 14,
})

const $dateFilterRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $dateFilter: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $filterActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $clearButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  flex: 1,
  minHeight: 48,
})

const $clearButtonText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })

const $applyButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderColor: colors.tint,
  borderRadius: 12,
  flex: 1,
  minHeight: 48,
})

const $applyButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
})
