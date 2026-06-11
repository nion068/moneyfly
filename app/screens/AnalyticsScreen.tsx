import { FC, useCallback, useEffect, useRef, useState } from "react"
import { Modal, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useScrollToTop } from "@react-navigation/native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"

import { Chip, FinanceCard, MetricPill, ProgressBar } from "@/components/firefly/FinancePrimitives"
import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useFirefly, LoadState } from "@/context/FireflyContext"
import type { FlatTransaction } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { FireflyApi } from "@/services/firefly/api"
import {
  AnalyticsPeriod,
  buildMonthlySummary,
  flattenFireflyTransactions,
  formatMoney,
  getAnalyticsRange,
  groupExpensesByAccount,
  groupExpensesByCategory,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDisplayNumber } from "@/utils/numbers"

type AnalyticsScreenProps = MainTabScreenProps<"Analytics">

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Quarter", value: "quarter" },
  { label: "Year", value: "year" },
]

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Date(2020, month, 1).toLocaleDateString("en-US", { month: "short" }),
)

export const AnalyticsScreen: FC<AnalyticsScreenProps> = ({ navigation }) => {
  const { themed } = useAppTheme()
  const {
    selectedMonth,
    setSelectedMonth,
    transactions,
    summariesByCurrency,
    selectedCurrency,
    setSelectedCurrency,
    refresh,
    isRefreshing,
    baseUrl,
    token,
    isConfigured,
  } = useFirefly()

  const [period, setPeriod] = useState<AnalyticsPeriod>("month")
  const [rangeTransactions, setRangeTransactions] = useState<LoadState<FlatTransaction[]>>({
    data: [],
    status: "idle",
  })
  const [showYears, setShowYears] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [categoryExpanded, setCategoryExpanded] = useState(true)
  const [accountExpanded, setAccountExpanded] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const scrollRef = useRef<any>(null)
  const categoryLayouts = useRef<Record<string, number>>({})

  useScrollToTop(scrollRef)

  const handleCategorySelect = useCallback((categoryName: string) => {
    setSelectedCategory((prev) => (prev === categoryName ? null : categoryName))
    setCategoryExpanded(true)
    setExpandedCategory((prev) => (prev === categoryName ? null : categoryName))

    setTimeout(() => {
      const y = categoryLayouts.current[categoryName]
      if (typeof y === "number" && scrollRef.current) {
        scrollRef.current.scrollTo({ y: y - 10, animated: true })
      }
    }, 100)
  }, [])

  const fetchRef = useRef(0)
  const monthScrollRef = useRef<ScrollView>(null)
  const now = new Date()

  // Scroll month strip to selected month when picker changes year
  useEffect(() => {
    const timeout = setTimeout(() => {
      monthScrollRef.current?.scrollTo({
        x: Math.max(0, selectedMonth.getMonth() * 66 - 120),
        animated: true,
      })
    }, 50)
    return () => clearTimeout(timeout)
  }, [selectedMonth])

  const loadRange = useCallback(async () => {
    if (!isConfigured) return
    const currentFetch = ++fetchRef.current
    setRangeTransactions((prev) => ({ ...prev, status: "loading" }))
    const range = getAnalyticsRange(selectedMonth, period)
    const api = new FireflyApi(baseUrl, token)
    const result = await api.getTransactions(range)
    if (currentFetch !== fetchRef.current) return
    if (result.kind === "ok") {
      setRangeTransactions({
        data: flattenFireflyTransactions(result.data),
        status: "ready",
      })
    } else {
      setRangeTransactions((prev) => ({ ...prev, status: "error", error: result }))
    }
  }, [baseUrl, isConfigured, period, selectedMonth, token])

  useEffect(() => {
    // For "month" period, reuse the context transactions (already loaded) to avoid a duplicate call
    if (period === "month") {
      setRangeTransactions({ data: transactions.data, status: transactions.status })
      return
    }
    void loadRange()
  }, [period, transactions, loadRange])

  const effectiveCurrency = selectedCurrency ?? summariesByCurrency[0]?.currencyCode
  const currencyTransactions = rangeTransactions.data.filter(
    (t) => !effectiveCurrency || t.currencyCode === effectiveCurrency,
  )

  const summary = buildMonthlySummary(currencyTransactions)
  const categoryExpenses = groupExpensesByCategory(currencyTransactions)
  const accountExpenses = groupExpensesByAccount(currencyTransactions)

  const rangeLabel = (() => {
    const range = getAnalyticsRange(selectedMonth, period)
    if (period === "month") {
      return selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }
    const fmt = (d: string) => {
      const date = new Date(`${d}T12:00:00`)
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }
    return `${fmt(range.start)} – ${fmt(range.end)}, ${selectedMonth.getFullYear()}`
  })()

  const isLoading = rangeTransactions.status === "loading" && rangeTransactions.data.length === 0
  const isOverlayLoading =
    rangeTransactions.status === "loading" && rangeTransactions.data.length > 0

  const navigateHomeFiltered = (filterType: "category" | "account", name: string) => {
    navigation.navigate("Home", {
      screen: "Home",
      params: { filterType, filterName: name },
    } as never)
  }

  return (
    <>
      <Screen preset="fixed" safeAreaEdges={["top"]}>
        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={themed($container)}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={themed($header)}>
            <View style={themed($headerCopy)}>
              <Text text="Analytics" style={themed($title)} />
              <Text text={rangeLabel} style={themed($muted)} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open month picker"
              onPress={() => setShowYears(true)}
              style={({ pressed }) => themed([$calendarButton, pressed && $calendarButtonPressed])}
            >
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={23}
                style={themed($calendarIcon)}
              />
            </Pressable>
          </View>

          {/* Period selector */}
          <View style={themed($periods)}>
            {PERIODS.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                active={period === p.value}
                onPress={() => setPeriod(p.value)}
              />
            ))}
          </View>

          {/* Currency selector (only when multi-currency) */}
          {summariesByCurrency.length > 1 && (
            <View style={themed($currencyRow)}>
              {summariesByCurrency.map((currency) => (
                <Chip
                  key={currency.currencyCode}
                  label={currency.currencyCode}
                  active={currency.currencyCode === selectedCurrency}
                  onPress={() => setSelectedCurrency(currency.currencyCode)}
                />
              ))}
            </View>
          )}

          {/* Loading / error states */}
          {isRefreshing && <LoadingIndicator label="Refreshing…" compact />}
          {isOverlayLoading && <LoadingIndicator label="Loading…" compact />}
          {isLoading && <LoadingIndicator label="Loading analytics…" />}
          {rangeTransactions.status === "error" && (
            <Text
              text={`${rangeTransactions.error?.message ?? "Error"} Tap to retry.`}
              style={themed($errorText)}
              onPress={() => void loadRange()}
            />
          )}
          {transactions.status === "error" && period === "month" && (
            <Text
              text={`${transactions.error?.message ?? "Error"} Tap to retry.`}
              style={themed($errorText)}
              onPress={() => void refresh()}
            />
          )}
          {rangeTransactions.status !== "loading" &&
            currencyTransactions.length === 0 &&
            !isLoading && <Text text="No transactions for this period." style={themed($muted)} />}

          {/* Metric cards */}
          <View style={themed($metricRow)}>
            <MetricPill
              label="Income"
              value={formatMoney(summary.totalIncome, summary.currencySymbol)}
              tone="income"
              icon="↙"
              centered
              singleLineValue
            />
            <MetricPill
              label="Expenses"
              value={formatMoney(summary.totalExpense, summary.currencySymbol)}
              tone="expense"
              icon="↗"
              centered
              singleLineValue
            />
            <MetricPill
              label="Saved"
              value={`${formatDisplayNumber(summary.savingsRate)}%`}
              tone="saved"
              icon="✿"
              centered
              singleLineValue
            />
          </View>

          {/* Top Spending Breakdown */}
          <FinanceCard>
            <View style={themed($cardHeader)}>
              <Text text="Top Spending Breakdown" style={themed($cardTitle)} />
              <Text
                text={selectedMonth.toLocaleDateString("en-US", { month: "long" })}
                style={themed($muted)}
              />
            </View>
            {categoryExpenses.length > 0 ? (
              <View style={themed($breakdownChart)}>
                {categoryExpenses.slice(0, 6).map((category) => (
                  <BreakdownBar
                    key={category.name}
                    category={category}
                    currencySymbol={summary.currencySymbol}
                    isSelected={selectedCategory === category.name}
                    onPress={() => handleCategorySelect(category.name)}
                  />
                ))}
              </View>
            ) : (
              <View style={themed($breakdownEmpty)}>
                <Text text="No expenses for this period." style={themed($muted)} />
              </View>
            )}
          </FinanceCard>

          {/* By Category */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setCategoryExpanded((v) => !v)}
            style={themed($sectionToggle)}
          >
            <Text text="By Category" style={themed($sectionTitle)} />
            <Text
              text={categoryExpanded ? "Collapse ↑" : "Tap to expand ↓"}
              style={themed($sectionAction)}
            />
          </Pressable>

          {categoryExpanded &&
            categoryExpenses.map((category) => {
              const isOpen = expandedCategory === category.name
              return (
                <View
                  key={category.name}
                  testID={`category-card-${category.name}`}
                  onLayout={(e) => {
                    categoryLayouts.current[category.name] = e.nativeEvent.layout.y
                  }}
                >
                  <FinanceCard>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setExpandedCategory(isOpen ? null : category.name)}
                      style={themed($categoryHeader)}
                    >
                      <View style={[themed($categoryDot), { backgroundColor: category.color }]} />
                      <Text text={category.name} style={themed($categoryName)} numberOfLines={1} />
                      <Text
                        text={formatMoney(category.amount, summary.currencySymbol)}
                        style={themed($categoryAmount)}
                      />
                      <Text
                        text={`${formatDisplayNumber(category.percentage)}%`}
                        style={themed($categoryPercent)}
                      />
                      <MaterialCommunityIcons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        style={themed($dimIcon)}
                      />
                    </Pressable>
                    <ProgressBar value={category.percentage} color={category.color} />

                    {isOpen && (
                      <View style={themed($transactionList)}>
                        {category.transactions.slice(0, 5).map((t) => (
                          <TransactionRow
                            key={t.journalId}
                            transaction={t}
                            currencySymbol={summary.currencySymbol}
                          />
                        ))}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => navigateHomeFiltered("category", category.name)}
                          style={themed($viewAll)}
                        >
                          <Text text={`View all transactions →`} style={themed($viewAllText)} />
                        </Pressable>
                      </View>
                    )}
                  </FinanceCard>
                </View>
              )
            })}

          {/* By Account */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAccountExpanded((v) => !v)}
            style={themed($sectionToggle)}
          >
            <Text text="By Account" style={themed($sectionTitle)} />
            <Text
              text={accountExpanded ? "Collapse ↑" : "Tap to expand ↓"}
              style={themed($sectionAction)}
            />
          </Pressable>

          {accountExpanded &&
            accountExpenses.map((account) => {
              const isOpen = expandedAccount === account.name
              return (
                <FinanceCard key={account.name}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpandedAccount(isOpen ? null : account.name)}
                    style={themed($categoryHeader)}
                  >
                    <View style={[themed($categoryDot), { backgroundColor: account.color }]} />
                    <Text text={account.name} style={themed($categoryName)} numberOfLines={1} />
                    <Text
                      text={formatMoney(account.amount, summary.currencySymbol)}
                      style={themed($categoryAmount)}
                    />
                    <Text
                      text={`${formatDisplayNumber(account.percentage)}%`}
                      style={themed($categoryPercent)}
                    />
                    <MaterialCommunityIcons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      style={themed($dimIcon)}
                    />
                  </Pressable>
                  <ProgressBar value={account.percentage} color={account.color} />

                  {isOpen && (
                    <View style={themed($transactionList)}>
                      {account.transactions.slice(0, 5).map((t) => (
                        <TransactionRow
                          key={t.journalId}
                          transaction={t}
                          currencySymbol={summary.currencySymbol}
                        />
                      ))}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => navigateHomeFiltered("account", account.name)}
                        style={themed($viewAll)}
                      >
                        <Text text={`View all transactions →`} style={themed($viewAllText)} />
                      </Pressable>
                    </View>
                  )}
                </FinanceCard>
              )
            })}
        </KeyboardAwareScrollView>
      </Screen>

      {/* Year picker modal (same pattern as HomeScreen) */}
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
        monthScrollRef={monthScrollRef}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        now={now}
      />
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BreakdownBar({
  category,
  currencySymbol,
  isSelected,
  onPress,
}: {
  category: { name: string; amount: number; color: string; percentage: number }
  currencySymbol: string
  isSelected: boolean
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={`breakdown-row-${category.name}`}
      style={themed([$breakdownBarRow, isSelected && $breakdownBarRowSelected])}
    >
      <View style={themed($breakdownBarHeader)}>
        <Text
          text={category.name}
          style={themed([$breakdownBarName, isSelected && $breakdownBarTextSelected])}
          numberOfLines={1}
        />
        <Text
          text={formatMoney(category.amount, currencySymbol)}
          style={themed([$breakdownBarAmount, isSelected && $breakdownBarTextSelected])}
          numberOfLines={1}
        />
        <Text
          text={`${formatDisplayNumber(category.percentage)}%`}
          style={themed([$breakdownBarPercent, isSelected && $breakdownBarTextSelected])}
          numberOfLines={1}
        />
      </View>
      <View style={themed($breakdownBarTrack)}>
        <View
          testID={`breakdown-bar-${category.name}`}
          style={[
            themed($breakdownBarFill),
            {
              backgroundColor: category.color,
              width: `${Math.min(100, Math.max(0, category.percentage))}%`,
            },
          ]}
        />
      </View>
    </Pressable>
  )
}

function TransactionRow({
  transaction,
  currencySymbol,
}: {
  transaction: FlatTransaction
  currencySymbol: string
}) {
  const { themed } = useAppTheme()
  const isDeposit = transaction.type === "deposit"
  const sign = isDeposit ? "+" : "-"
  const amountStyle = isDeposit ? $txAmountPositive : $txAmountNegative
  const dateLabel = new Date(`${transaction.date.slice(0, 10)}T12:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  )
  return (
    <View style={themed($txRow)}>
      <View style={themed($txMain)}>
        <Text text={transaction.description} style={themed($txTitle)} numberOfLines={1} />
        <Text
          text={`${dateLabel} · ${transaction.sourceName}`}
          style={themed($txMeta)}
          numberOfLines={1}
        />
      </View>
      <Text
        text={`${sign}${formatMoney(transaction.amount, currencySymbol)}`}
        style={themed(amountStyle)}
      />
    </View>
  )
}

function YearPicker({
  visible,
  selectedYear,
  maximumYear,
  onSelect,
  onClose,
  monthScrollRef,
  selectedMonth,
  setSelectedMonth,
  now,
}: {
  visible: boolean
  selectedYear: number
  maximumYear: number
  onSelect: (year: number) => void
  onClose: () => void
  monthScrollRef: React.RefObject<ScrollView | null>
  selectedMonth: Date
  setSelectedMonth: (month: Date) => void
  now: Date
}) {
  const { themed } = useAppTheme()
  const [decadeStart, setDecadeStart] = useState(Math.floor(selectedYear / 10) * 10)
  useEffect(() => setDecadeStart(Math.floor(selectedYear / 10) * 10), [selectedYear, visible])
  const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={themed($modalOverlay)}>
        <Pressable style={themed($modalDismiss)} onPress={onClose} />
        <View style={themed($yearModal)}>
          {/* Month strip */}
          <ScrollView
            ref={monthScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themed($monthStrip)}
          >
            {monthNames.map((name, monthIndex) => {
              const isCurrentYear = selectedYear === now.getFullYear()
              const disabled = isCurrentYear && monthIndex > now.getMonth()
              const active =
                monthIndex === selectedMonth.getMonth() &&
                selectedYear === selectedMonth.getFullYear()
              return (
                <Pressable
                  key={name}
                  disabled={disabled}
                  onPress={() => {
                    setSelectedMonth(new Date(selectedYear, monthIndex, 1))
                    onClose()
                  }}
                  style={themed([$monthChip, active && $activeMonthChip])}
                >
                  <Text
                    text={name}
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

          {/* Year grid */}
          <View style={themed($yearModalHeader)}>
            <Pressable onPress={() => setDecadeStart((y) => y - 10)} style={themed($iconTap)}>
              <MaterialCommunityIcons name="chevron-left" size={26} style={themed($icon)} />
            </Pressable>
            <Text text={`${decadeStart}–${decadeStart + 9}`} style={themed($yearModalTitle)} />
            <Pressable
              disabled={decadeStart + 10 > maximumYear}
              onPress={() => setDecadeStart((y) => y + 10)}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.lg,
  padding: spacing.lg,
  paddingBottom: spacing.xxxl,
})

const $header: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $headerCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 32,
  lineHeight: 38,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  lineHeight: 20,
})

const $calendarButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  height: 44,
  justifyContent: "center",
  width: 44,
})

const $calendarButtonPressed: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
})

const $calendarIcon: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})

const $periods: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 22,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "space-between",
  padding: spacing.xs,
})

const $currencyRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
  fontSize: 13,
})

const $metricRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $cardHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $cardTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 18,
})

const $breakdownChart: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  marginTop: spacing.md,
})

const $breakdownEmpty: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  justifyContent: "center",
  minHeight: 112,
  paddingVertical: spacing.lg,
})

const $breakdownBarRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  borderRadius: 10,
  gap: spacing.xs,
  padding: spacing.xs,
})

const $breakdownBarRowSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
})

const $breakdownBarHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
})

const $breakdownBarName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  flex: 1,
  fontFamily: typography.primary.medium,
  fontSize: 13,
})

const $breakdownBarAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 13,
})

const $breakdownBarPercent: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  minWidth: 42,
  textAlign: "right",
})

const $breakdownBarTextSelected: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
})

const $breakdownBarTrack: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHighest,
  borderRadius: 999,
  height: 10,
  overflow: "hidden",
})

const $breakdownBarFill: ThemedStyle<ViewStyle> = () => ({
  borderRadius: 999,
  height: 10,
})

const $sectionToggle: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 20,
  lineHeight: 26,
})

const $sectionAction: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.medium,
  fontSize: 13,
})

const $categoryHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
  marginBottom: spacing.sm,
})

const $categoryDot: ThemedStyle<ViewStyle> = () => ({
  borderRadius: 10,
  height: 20,
  width: 20,
})

const $categoryName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  flex: 1,
  fontFamily: typography.primary.medium,
  fontSize: 15,
})

const $categoryAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 14,
})

const $categoryPercent: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
})

const $dimIcon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
const $icon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })

const $transactionList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  marginTop: spacing.md,
})

const $txRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 44,
})

const $txMain: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $txTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 14,
})

const $txMeta: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
})

const $txAmountPositive: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
  fontSize: 13,
})

const $txAmountNegative: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.semiBold,
  fontSize: 13,
})

const $viewAll: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-start",
  paddingTop: spacing.xs,
})

const $viewAllText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.medium,
  fontSize: 13,
})

// ─── Year/Month picker styles (match HomeScreen pattern) ─────────────────────

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

const $monthStrip: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  paddingBottom: spacing.sm,
  paddingHorizontal: spacing.xxs,
})

const $monthChip: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  borderColor: colors.palette.stroke,
  borderRadius: 22,
  borderWidth: 1,
  justifyContent: "center",
  minHeight: 40,
  width: 54,
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

const $yearModalHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 8,
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
