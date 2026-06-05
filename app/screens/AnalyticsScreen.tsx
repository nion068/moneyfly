import { FC, useMemo } from "react"
import { TextStyle, View, ViewStyle } from "react-native"

import {
  Chip,
  FinanceCard,
  MetricPill,
  ProgressBar,
  SectionHeader,
} from "@/components/firefly/FinancePrimitives"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useFirefly } from "@/context/FireflyContext"
import type { CategoryExpense } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import {
  buildMonthlySummary,
  formatMoney,
  groupExpensesByCategory,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type AnalyticsScreenProps = MainTabScreenProps<"Analytics">

export const AnalyticsScreen: FC<AnalyticsScreenProps> = () => {
  const { themed } = useAppTheme()
  const {
    selectedMonth,
    transactions,
    summariesByCurrency,
    selectedCurrency,
    setSelectedCurrency,
    refresh,
  } = useFirefly()
  const effectiveCurrency = selectedCurrency ?? summariesByCurrency[0]?.currencyCode
  const currencyTransactions = transactions.data.filter(
    (transaction) => !effectiveCurrency || transaction.currencyCode === effectiveCurrency,
  )
  const summary = buildMonthlySummary(currencyTransactions)
  const categoryExpenses = groupExpensesByCategory(currencyTransactions)
  const daily = useMemo(() => {
    const numberOfDays = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      0,
    ).getDate()
    let cumulative = 0
    return Array.from({ length: numberOfDays }, (_, index) => {
      const day = index + 1
      const items = currencyTransactions.filter(
        (transaction) => Number(transaction.date.slice(8, 10)) === day,
      )
      const income = items
        .filter((item) => item.type === "deposit")
        .reduce((total, item) => total + item.amount, 0)
      const expense = items
        .filter((item) => item.type === "withdrawal")
        .reduce((total, item) => total + item.amount, 0)
      cumulative += income - expense
      return { day, income, expense, cumulative }
    })
  }, [currencyTransactions, selectedMonth])
  const maximumDaily = Math.max(...daily.flatMap((day) => [day.income, day.expense]), 1)
  const cumulativeValues = daily.map((day) => day.cumulative)
  const minimumCumulative = Math.min(...cumulativeValues, 0)
  const maximumCumulative = Math.max(...cumulativeValues, 1)
  const cumulativeRange = maximumCumulative - minimumCumulative || 1
  const accountExpenses = currencyTransactions
    .filter((transaction) => transaction.type === "withdrawal")
    .reduce<Record<string, number>>((result, transaction) => {
      const name = transaction.sourceName || "Unknown account"
      result[name] = (result[name] ?? 0) + transaction.amount
      return result
    }, {})
  const monthLabel = selectedMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($header)}>
        <View>
          <Text text="Analytics" style={themed($title)} />
          <Text text={monthLabel} style={themed($muted)} />
        </View>
        <Text text="▣" style={themed($calendar)} />
      </View>

      {summariesByCurrency.length > 1 && (
        <View style={themed($periods)}>
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

      {transactions.status === "loading" && <Text text="Loading Firefly analytics..." />}
      {transactions.status === "error" && (
        <Text
          text={`${transactions.error?.message} Tap to retry.`}
          style={themed($negative)}
          onPress={() => void refresh()}
        />
      )}
      {transactions.status !== "loading" && currencyTransactions.length === 0 && (
        <Text text="No transactions are available for this month." style={themed($muted)} />
      )}

      <View style={themed($metricRow)}>
        <MetricPill
          label="Income"
          value={formatMoney(summary.totalIncome, summary.currencySymbol)}
          tone="income"
          icon="↙"
        />
        <MetricPill
          label="Expenses"
          value={formatMoney(summary.totalExpense, summary.currencySymbol)}
          tone="expense"
          icon="↗"
        />
        <MetricPill label="Saved" value={`${summary.savingsRate}%`} tone="saved" icon="✿" />
      </View>

      <FinanceCard>
        <View style={themed($cardHeader)}>
          <Text text="Cumulative Cash Flow" style={themed($cardTitle)} />
          <Text
            text={formatMoney(summary.netBalance, summary.currencySymbol)}
            style={themed(summary.netBalance >= 0 ? $positive : $negative)}
          />
        </View>
        <View style={themed($lineChart)}>
          {daily.map((point, index) => (
            <View
              key={point.day}
              style={[
                themed($linePoint),
                {
                  bottom: `${((point.cumulative - minimumCumulative) / cumulativeRange) * 90}%`,
                  left: `${(index / Math.max(daily.length - 1, 1)) * 96}%`,
                },
              ]}
            />
          ))}
        </View>
        <View style={themed($axisLabels)}>
          <Text text="1" style={themed($muted)} />
          <Text text={String(Math.ceil(daily.length / 2))} style={themed($muted)} />
          <Text text={String(daily.length)} style={themed($muted)} />
        </View>
      </FinanceCard>

      <FinanceCard>
        <View style={themed($cardHeader)}>
          <Text text="Daily Income / Expense" style={themed($cardTitle)} />
          <Text text="● Income   ● Expenses" style={themed($legendText)} />
        </View>
        <View style={themed($barChart)}>
          {daily.map((day) => (
            <View key={day.day} style={themed($barGroup)}>
              <View
                style={[
                  themed($incomeBar),
                  { height: Math.max(2, (day.income / maximumDaily) * 90) },
                ]}
              />
              <View
                style={[
                  themed($expenseBar),
                  { height: Math.max(2, (day.expense / maximumDaily) * 90) },
                ]}
              />
            </View>
          ))}
        </View>
      </FinanceCard>

      <FinanceCard>
        <View style={themed($cardHeader)}>
          <Text text="Spending Breakdown" style={themed($cardTitle)} />
          <Text
            text={selectedMonth.toLocaleDateString("en-US", { month: "long" })}
            style={themed($muted)}
          />
        </View>
        <View style={themed($breakdownRow)}>
          <View style={themed($donut)}>
            <Text
              text={formatMoney(summary.totalExpense, summary.currencySymbol)}
              style={themed($donutAmount)}
            />
            <Text text="total" style={themed($muted)} />
          </View>
          <View style={themed($legend)}>
            {categoryExpenses.slice(0, 6).map((category) => (
              <LegendRow key={category.name} category={category} />
            ))}
          </View>
        </View>
      </FinanceCard>

      <FinanceCard>
        <SectionHeader title="Top Categories" />
        {categoryExpenses.slice(0, 5).map((category) => (
          <View key={category.name} style={themed($categoryRow)}>
            <Text text={category.name} style={themed($categoryName)} />
            <Text
              text={formatMoney(category.amount, summary.currencySymbol)}
              style={themed($categoryAmount)}
            />
            <ProgressBar value={category.percentage} color={category.color} />
          </View>
        ))}
      </FinanceCard>

      <SectionHeader title="By Account" />
      {Object.entries(accountExpenses)
        .sort(([, left], [, right]) => right - left)
        .map(([account, expense]) => (
          <FinanceCard key={account}>
            <View style={themed($cardHeader)}>
              <Text text={account} style={themed($cardTitle)} />
              <Text text={formatMoney(expense, summary.currencySymbol)} style={themed($negative)} />
            </View>
            <ProgressBar
              value={summary.totalExpense > 0 ? (expense / summary.totalExpense) * 100 : 0}
            />
          </FinanceCard>
        ))}
    </Screen>
  )
}

function LegendRow({ category }: { category: CategoryExpense }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($legendRow)}>
      <View style={[themed($legendDot), { backgroundColor: category.color }]} />
      <Text text={category.name} style={themed($legendName)} />
      <Text text={`${category.percentage}%`} style={themed($legendPercent)} />
    </View>
  )
}

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

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 40,
  lineHeight: 48,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
})

const $calendar: ThemedStyle<TextStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 22,
  color: colors.textDim,
  fontSize: 22,
  height: 44,
  lineHeight: 44,
  overflow: "hidden",
  textAlign: "center",
  width: 44,
})

const $periods: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderRadius: 22,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "space-between",
  padding: spacing.xs,
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

const $positive: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 13,
})

const $negative: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
  fontSize: 13,
})

const $lineChart: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "rgba(62, 165, 118, 0.08)",
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
  height: 130,
  marginTop: 12,
  position: "relative",
})

const $linePoint: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderRadius: 5,
  height: 10,
  position: "absolute",
  width: 10,
})

const $axisLabels: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  justifyContent: "space-between",
})

const $legendText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
})

const $barChart: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-end",
  flexDirection: "row",
  gap: spacing.lg,
  height: 100,
  justifyContent: "center",
  marginTop: spacing.md,
})

const $barGroup: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-end",
  flexDirection: "row",
  gap: spacing.xs,
})

const $incomeBar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderRadius: 10,
  width: 28,
})

const $expenseBar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.tertiary300,
  borderRadius: 10,
  width: 28,
})

const $breakdownRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.lg,
  marginTop: spacing.md,
})

const $donut: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  borderColor: colors.palette.secondary300,
  borderRadius: 62,
  borderWidth: 18,
  height: 124,
  justifyContent: "center",
  width: 124,
})

const $donutAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})

const $legend: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.sm,
})

const $legendRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
})

const $legendDot: ThemedStyle<ViewStyle> = () => ({
  borderRadius: 5,
  height: 10,
  width: 10,
})

const $legendName: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
})

const $legendPercent: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})

const $categoryRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  marginTop: spacing.md,
})

const $categoryName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 16,
})

const $categoryAmount: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})
