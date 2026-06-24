import { FC, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Modal, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useScrollToTop } from "@react-navigation/native"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { Circle, Line, Path, Svg } from "react-native-svg"

import { Chip, FinanceCard, MetricPill, ProgressBar } from "@/components/firefly/FinancePrimitives"
import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { SelectionItem, SelectionSheet } from "@/components/firefly/SelectionSheet"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useFirefly, LoadState } from "@/context/FireflyContext"
import type { FlatTransaction } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { FireflyApi } from "@/services/firefly/api"
import {
  AnalyticsPeriod,
  AnalyticsTrendPoint,
  buildAnalyticsTrend,
  buildMonthlySummary,
  filterTransactionsByCategoryNames,
  flattenFireflyTransactions,
  formatMoney,
  getAnalyticsBuckets,
  getAnalyticsRange,
  getAnalyticsWindow,
  groupExpensesByAccount,
  groupExpensesByCategory,
  startOfCurrentMonth,
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

type ChartMetric = "income" | "expense" | "netSavings"

const CHART_METRICS: { label: string; value: ChartMetric }[] = [
  { label: "Income", value: "income" },
  { label: "Expenses", value: "expense" },
  { label: "Net", value: "netSavings" },
]

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Date(2020, month, 1).toLocaleDateString("en-US", { month: "short" }),
)

export const AnalyticsScreen: FC<AnalyticsScreenProps> = ({ navigation }) => {
  const { themed } = useAppTheme()
  const {
    transactions,
    summariesByCurrency,
    selectedCurrency,
    setSelectedCurrency,
    categories,
    isRefreshing,
    baseUrl,
    token,
    isConfigured,
  } = useFirefly()

  const [analyticsMonth, setAnalyticsMonth] = useState(startOfCurrentMonth)
  const [period, setPeriod] = useState<AnalyticsPeriod>("month")
  const [showPeriods, setShowPeriods] = useState(false)
  const [chartMetric, setChartMetric] = useState<ChartMetric>("expense")
  const [selectedTrendPoint, setSelectedTrendPoint] = useState<number | null>(null)
  const [rangeTransactions, setRangeTransactions] = useState<LoadState<FlatTransaction[]>>({
    data: transactions.data,
    status: transactions.status,
  })
  const [showYears, setShowYears] = useState(false)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [categoryExpanded, setCategoryExpanded] = useState(true)
  const [accountExpanded, setAccountExpanded] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>([])
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
        x: Math.max(0, analyticsMonth.getMonth() * 66 - 120),
        animated: true,
      })
    }, 50)
    return () => clearTimeout(timeout)
  }, [analyticsMonth])

  const loadRange = useCallback(async () => {
    if (!isConfigured) return
    const currentFetch = ++fetchRef.current
    setRangeTransactions((prev) => ({ ...prev, status: "loading" }))
    const range = getAnalyticsWindow(analyticsMonth, period)
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
  }, [analyticsMonth, baseUrl, isConfigured, period, token])

  useEffect(() => {
    void loadRange()
  }, [loadRange])

  const effectiveCurrency = selectedCurrency ?? summariesByCurrency[0]?.currencyCode
  const currencyTransactions = rangeTransactions.data.filter(
    (t) => !effectiveCurrency || t.currencyCode === effectiveCurrency,
  )

  const analyticsBuckets = useMemo(
    () => getAnalyticsBuckets(analyticsMonth, period),
    [analyticsMonth, period],
  )
  const analyticsCategoryItems = useMemo<SelectionItem[]>(() => {
    const names = new Set<string>()

    categories.data.forEach((category) => {
      const name = category.attributes.name.trim()
      if (name) names.add(name)
    })
    currencyTransactions.forEach((transaction) => {
      const name = transaction.categoryName ?? "Uncategorized"
      if (name.trim()) names.add(name)
    })

    return Array.from(names)
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({ id: name, title: name, icon: "shape-outline" }))
  }, [categories.data, currencyTransactions])
  const filteredTrendTransactions = useMemo(
    () => filterTransactionsByCategoryNames(currencyTransactions, selectedCategoryNames),
    [currencyTransactions, selectedCategoryNames],
  )
  const filteredPageTransactions = filteredTrendTransactions
  const activeBucket = analyticsBuckets[analyticsBuckets.length - 1]
  const activeTransactions = filteredPageTransactions.filter((transaction) => {
    const date = transaction.date.slice(0, 10)
    return date >= activeBucket.start && date <= activeBucket.end
  })
  const trendPoints = buildAnalyticsTrend(filteredPageTransactions, analyticsBuckets)
  const summary = {
    ...buildMonthlySummary(activeTransactions),
    currencySymbol:
      activeTransactions[0]?.currencySymbol ??
      summariesByCurrency.find((currency) => currency.currencyCode === effectiveCurrency)
        ?.currencySymbol ??
      filteredPageTransactions[0]?.currencySymbol ??
      currencyTransactions[0]?.currencySymbol ??
      "৳",
  }
  const categoryExpenses = groupExpensesByCategory(activeTransactions)
  const accountExpenses = groupExpensesByAccount(activeTransactions)

  const rangeLabel = (() => {
    const range = getAnalyticsRange(analyticsMonth, period)
    if (period === "month") {
      return analyticsMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }
    const fmt = (d: string) => {
      const date = new Date(`${d}T12:00:00`)
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    }
    return `${fmt(range.start)} – ${fmt(range.end)}, ${analyticsMonth.getFullYear()}`
  })()

  const isLoading = rangeTransactions.status === "loading" && rangeTransactions.data.length === 0
  const isOverlayLoading =
    rangeTransactions.status === "loading" && rangeTransactions.data.length > 0

  useEffect(() => {
    setSelectedTrendPoint((current) => (current === null ? current : null))
  }, [analyticsMonth, chartMetric, period, selectedCategoryNames])

  useEffect(() => {
    if (selectedCategoryNames.length === 0) return

    const availableNames = new Set(analyticsCategoryItems.map((item) => item.id))
    setSelectedCategoryNames((current) =>
      current.every((categoryName) => availableNames.has(categoryName))
        ? current
        : current.filter((categoryName) => availableNames.has(categoryName)),
    )
  }, [analyticsCategoryItems, selectedCategoryNames.length])

  useEffect(() => {
    if (!selectedCategory || categoryExpenses.some((category) => category.name === selectedCategory)) return
    setSelectedCategory(null)
  }, [categoryExpenses, selectedCategory])

  useEffect(() => {
    if (!expandedCategory || categoryExpenses.some((category) => category.name === expandedCategory)) return
    setExpandedCategory(null)
  }, [categoryExpenses, expandedCategory])

  useEffect(() => {
    if (!expandedAccount || accountExpenses.some((account) => account.name === expandedAccount)) return
    setExpandedAccount(null)
  }, [accountExpenses, expandedAccount])

  const categoryFilterLabel =
    selectedCategoryNames.length === 0
      ? "All categories"
      : selectedCategoryNames.length === 1
        ? selectedCategoryNames[0]
        : `${selectedCategoryNames.length} selected`

  const navigateHomeFiltered = (filterType: "category" | "account", name: string) => {
    navigation.navigate("Home", {
      screen: "Home",
      params: { filterType, filterName: name },
    } as never)
  }
  const openFireflySettings = () => navigation.navigate("Settings", { screen: "SettingsFirefly" })

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
            <View style={themed($headerTopRow)}>
              <Text text="Analytics" style={themed($title)} />
              <View style={themed($periodButtonSlot)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select analytics period"
                  onPress={() => setShowPeriods(true)}
                  style={({ pressed }) =>
                    themed([$periodButton, pressed && $calendarButtonPressed])
                  }
                >
                  <Text
                    text={PERIODS.find((option) => option.value === period)?.label}
                    style={themed($periodButtonText)}
                  />
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    style={themed($calendarIcon)}
                  />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open month picker"
                onPress={() => setShowYears(true)}
                style={({ pressed }) =>
                  themed([$calendarButton, pressed && $calendarButtonPressed])
                }
              >
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={23}
                  style={themed($calendarIcon)}
                />
              </Pressable>
            </View>
            <Text text={rangeLabel} style={themed($muted)} />
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
              onPress={() => (isConfigured ? void loadRange() : openFireflySettings())}
            />
          )}
          {rangeTransactions.status !== "loading" &&
            activeTransactions.length === 0 &&
            !isLoading && <Text text="No transactions for this period." style={themed($muted)} />}

          <View style={themed($pageFilterRow)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open analytics category filter"
              onPress={() => setShowCategoryFilter(true)}
              style={themed($pageFilterButton)}
              testID="analytics-category-filter-button"
            >
              <MaterialCommunityIcons name="shape-outline" size={16} style={themed($pageFilterIcon)} />
              <Text text={categoryFilterLabel} style={themed($pageFilterText)} numberOfLines={1} />
              <MaterialCommunityIcons name="chevron-down" size={18} style={themed($dimIcon)} />
            </Pressable>
            {selectedCategoryNames.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear analytics category filter"
                onPress={() => setSelectedCategoryNames([])}
                style={themed($pageFilterClear)}
              >
                <Text text="Clear" style={themed($pageFilterClearText)} />
              </Pressable>
            )}
          </View>

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

          <TrendChart
            points={trendPoints}
            period={period}
            metric={chartMetric}
            selectedPoint={selectedTrendPoint}
            currencySymbol={summary.currencySymbol}
            onMetricChange={setChartMetric}
            onPointSelect={setSelectedTrendPoint}
          />

          {/* Top Spending Breakdown */}
          <FinanceCard>
            <View style={themed($cardHeader)}>
              <Text text="Top Spending Breakdown" style={themed($cardTitle)} />
              <Text text={activeBucket.label} style={themed($muted)} />
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

      <PeriodMenu
        visible={showPeriods}
        selectedPeriod={period}
        onSelect={(nextPeriod) => {
          setPeriod(nextPeriod)
          setShowPeriods(false)
        }}
        onClose={() => setShowPeriods(false)}
      />

      {/* Year picker modal (same pattern as HomeScreen) */}
      <YearPicker
        visible={showYears}
        selectedYear={analyticsMonth.getFullYear()}
        maximumYear={now.getFullYear()}
        onSelect={(year) => {
          const monthIndex =
            year === now.getFullYear()
              ? Math.min(analyticsMonth.getMonth(), now.getMonth())
              : analyticsMonth.getMonth()
          setAnalyticsMonth(new Date(year, monthIndex, 1))
          setShowYears(false)
        }}
        onClose={() => setShowYears(false)}
        monthScrollRef={monthScrollRef}
        selectedMonth={analyticsMonth}
        setSelectedMonth={setAnalyticsMonth}
        now={now}
      />
      <SelectionSheet
        visible={showCategoryFilter}
        title="Categories"
        items={analyticsCategoryItems}
        selectedIds={selectedCategoryNames}
        multiple
        onSelect={setSelectedCategoryNames}
        onClose={() => setShowCategoryFilter(false)}
      />
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PeriodMenu({
  visible,
  selectedPeriod,
  onSelect,
  onClose,
}: {
  visible: boolean
  selectedPeriod: AnalyticsPeriod
  onSelect: (period: AnalyticsPeriod) => void
  onClose: () => void
}) {
  const { themed } = useAppTheme()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={themed($periodMenuOverlay)}>
        <Pressable style={themed($periodMenuDismiss)} onPress={onClose} />
        <View style={themed($periodMenu)} testID="analytics-period-menu">
          {PERIODS.map((option) => {
            const selected = option.value === selectedPeriod
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => onSelect(option.value)}
                style={themed([$periodMenuItem, selected && $periodMenuItemSelected])}
              >
                <Text
                  text={option.label}
                  style={themed([$periodMenuText, selected && $periodMenuTextSelected])}
                />
                {selected && (
                  <MaterialCommunityIcons name="check" size={18} style={themed($calendarIcon)} />
                )}
              </Pressable>
            )
          })}
        </View>
      </View>
    </Modal>
  )
}

function TrendChart({
  points,
  period,
  metric,
  selectedPoint,
  currencySymbol,
  onMetricChange,
  onPointSelect,
}: {
  points: AnalyticsTrendPoint[]
  period: AnalyticsPeriod
  metric: ChartMetric
  selectedPoint: number | null
  currencySymbol: string
  onMetricChange: (metric: ChartMetric) => void
  onPointSelect: (index: number) => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const [width, setWidth] = useState(300)
  const chartHeight = 160
  const horizontalPadding = 16
  const verticalPadding = 16
  const values = points.map((point) => point[metric])
  const isEmpty = values.every((value) => value === 0)
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(0, ...values)
  const valueRange = maximum - minimum || 1
  const plotWidth = Math.max(1, width - horizontalPadding * 2)
  const plotHeight = chartHeight - verticalPadding * 2
  const coordinates = values.map((value, index) => ({
    x: horizontalPadding + (index / Math.max(1, values.length - 1)) * plotWidth,
    y: verticalPadding + ((maximum - value) / valueRange) * plotHeight,
  }))
  const path = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")
  const zeroY = verticalPadding + ((maximum - 0) / valueRange) * plotHeight
  const lineColor =
    metric === "income"
      ? colors.tint
      : metric === "expense"
        ? colors.palette.tertiary300
        : colors.palette.secondary300
  const selected = selectedPoint === null ? null : points[selectedPoint]
  const periodLabel =
    period === "week"
      ? "weeks"
      : period === "month"
        ? "months"
        : period === "quarter"
          ? "quarters"
          : "years"

  return (
    <FinanceCard>
      <View style={themed($trendHeader)}>
        <View>
          <Text text="Cash Flow Trend" style={themed($cardTitle)} />
          <Text text={`Last 6 ${periodLabel}`} style={themed($muted)} />
        </View>
        {selected && (
          <View style={themed($trendValue)} testID="trend-selected-value">
            <Text text={selected.label} style={themed($trendValueLabel)} />
            <Text
              text={formatMoney(selected[metric], currencySymbol)}
              style={[themed($trendValueAmount), { color: lineColor }]}
            />
          </View>
        )}
      </View>

      <View style={themed($trendMetricTabs)}>
        {CHART_METRICS.map((option) => {
          const active = option.value === metric
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`trend-metric-${option.value}`}
              onPress={() => onMetricChange(option.value)}
              style={themed([$trendMetricTab, active && $trendMetricTabActive])}
            >
              <Text
                text={option.label}
                style={themed([$trendMetricText, active && $trendMetricTextActive])}
              />
            </Pressable>
          )
        })}
      </View>

      {isEmpty ? (
        <View style={themed($trendEmpty)}>
          <Text text="No activity for these periods." style={themed($muted)} />
        </View>
      ) : (
        <>
          <View
            testID="analytics-trend-chart"
            style={[themed($trendPlot), { height: chartHeight }]}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          >
            <Svg width={width} height={chartHeight}>
              <Line
                x1={horizontalPadding}
                x2={width - horizontalPadding}
                y1={zeroY}
                y2={zeroY}
                stroke={colors.palette.stroke}
                strokeWidth={1}
              />
              <Path
                d={path}
                fill="none"
                stroke={lineColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                testID="trend-line"
              />
              {coordinates.map((point, index) => (
                <Fragment key={points[index].key}>
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={selectedPoint === index ? 7 : 5}
                    fill={lineColor}
                    stroke={colors.palette.surfaceContainer}
                    strokeWidth={3}
                  />
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={16}
                    fill="transparent"
                    onPress={() => onPointSelect(index)}
                    testID={`trend-point-${index}`}
                  />
                </Fragment>
              ))}
            </Svg>
          </View>
          <View style={themed($trendLabels)}>
            {points.map((point) => (
              <Text key={point.key} text={point.label} style={themed($trendLabel)} />
            ))}
          </View>
        </>
      )}
    </FinanceCard>
  )
}

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

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
})

const $headerTopRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
})

const $periodButtonSlot: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  minWidth: 0,
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

const $periodButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  flexDirection: "row",
  gap: spacing.xxs,
  height: 44,
  justifyContent: "center",
  paddingHorizontal: spacing.md,
  width: "100%",
})

const $periodButtonText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 14,
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

const $pageFilterRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
})

const $pageFilterButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 14,
  borderWidth: 1,
  flex: 1,
  flexDirection: "row",
  gap: spacing.xs,
  minHeight: 44,
  paddingHorizontal: spacing.sm,
})

const $pageFilterIcon: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})

const $pageFilterText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  flex: 1,
  fontFamily: typography.primary.medium,
  fontSize: 13,
})

const $pageFilterClear: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  borderWidth: 1,
  justifyContent: "center",
  minHeight: 44,
  paddingHorizontal: spacing.sm,
})

const $pageFilterClearText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
  fontSize: 13,
})

const $trendHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "flex-start",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $trendValue: ThemedStyle<ViewStyle> = () => ({
  alignItems: "flex-end",
})

const $trendValueLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
})

const $trendValueAmount: ThemedStyle<TextStyle> = ({ typography }) => ({
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
})

const $trendMetricTabs: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainerHighest,
  borderRadius: 14,
  flexDirection: "row",
  gap: spacing.xxs,
  marginTop: spacing.md,
  padding: spacing.xxs,
})

const $trendMetricTab: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  borderRadius: 11,
  flex: 1,
  paddingHorizontal: spacing.xs,
  paddingVertical: spacing.xs,
})

const $trendMetricTabActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
})

const $trendMetricText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 12,
})

const $trendMetricTextActive: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})

const $trendPlot: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  overflow: "hidden",
  width: "100%",
})

const $trendLabels: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  justifyContent: "space-between",
})

const $trendLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  fontSize: 10,
  textAlign: "center",
})

const $trendEmpty: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  justifyContent: "center",
  minHeight: 140,
  paddingVertical: spacing.lg,
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

const $periodMenuOverlay: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $periodMenuDismiss: ThemedStyle<ViewStyle> = () => ({
  bottom: 0,
  left: 0,
  position: "absolute",
  right: 0,
  top: 0,
})

const $periodMenu: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  borderWidth: 1,
  elevation: 8,
  padding: spacing.xs,
  position: "absolute",
  right: 72,
  shadowColor: colors.palette.neutral900,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
  top: 70,
  width: 142,
})

const $periodMenuItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  borderRadius: 12,
  flexDirection: "row",
  justifyContent: "space-between",
  minHeight: 42,
  paddingHorizontal: spacing.sm,
})

const $periodMenuItemSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHighest,
})

const $periodMenuText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 14,
})

const $periodMenuTextSelected: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
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
