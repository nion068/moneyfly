import { FC, useMemo, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"

import {
  Chip,
  FinanceCard,
  MetricPill,
  ProgressBar,
  SectionHeader,
} from "@/components/firefly/FinancePrimitives"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import { FlatTransaction } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import {
  buildMonthlySummary,
  formatMoney,
  groupTransactionsByDate,
  maskMoney,
  shiftMonth,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type HomeScreenProps = MainTabScreenProps<"Home">

const filters = ["All", "Expenses", "Income"]

export const HomeScreen: FC<HomeScreenProps> = () => {
  const { themed } = useAppTheme()
  const {
    hideAmounts,
    toggleHideAmounts,
    selectedMonth,
    setSelectedMonth,
    transactions,
    selectedCurrency,
    summariesByCurrency,
    refresh,
  } = useFirefly()
  const [activeFilter, setActiveFilter] = useState("All")
  const [search, setSearch] = useState("")
  const months = useMemo(
    () => Array.from({ length: 6 }, (_, index) => shiftMonth(selectedMonth, index - 3)),
    [selectedMonth],
  )
  const effectiveCurrency = selectedCurrency ?? summariesByCurrency[0]?.currencyCode
  const currencyTransactions = transactions.data.filter(
    (transaction) => !effectiveCurrency || transaction.currencyCode === effectiveCurrency,
  )
  const categories = Array.from(
    new Set(currencyTransactions.map((transaction) => transaction.categoryName).filter(Boolean)),
  ) as string[]
  const visibleFilters = [...filters, ...categories.slice(0, 4)]
  const filteredTransactions = currencyTransactions
    .filter((transaction) => {
      if (activeFilter === "Expenses") return transaction.type === "withdrawal"
      if (activeFilter === "Income") return transaction.type === "deposit"
      if (!filters.includes(activeFilter)) return transaction.categoryName === activeFilter
      return true
    })
    .filter((transaction) => {
      const query = search.trim().toLowerCase()
      if (!query) return true
      return [
        transaction.description,
        transaction.categoryName,
        transaction.sourceName,
        transaction.destinationName,
        ...transaction.tags,
      ].some((value) => value?.toLowerCase().includes(query))
    })
    .sort((left, right) => right.date.localeCompare(left.date))
  const groupedTransactions = groupTransactionsByDate(filteredTransactions)
  const summary =
    summariesByCurrency.find((item) => item.currencyCode === effectiveCurrency) ??
    buildMonthlySummary([])

  const amount = (value: number) =>
    hideAmounts ? maskMoney(summary.currencySymbol) : formatMoney(value, summary.currencySymbol)

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($topBar)}>
        <View>
          <Text text={String(selectedMonth.getFullYear())} style={themed($year)} />
        </View>
        <View style={themed($topActions)}>
          <Text text="⌁" style={themed($actionGlyph)} />
          <Pressable onPress={toggleHideAmounts} style={themed($avatarButton)}>
            <Text text={hideAmounts ? "🙈" : "👁"} style={themed($avatarGlyph)} />
          </Pressable>
        </View>
      </View>

      <View style={themed($months)}>
        {months.map((month) => (
          <Chip
            key={month.toISOString()}
            label={month.toLocaleDateString("en-US", { month: "short" })}
            active={
              month.getMonth() === selectedMonth.getMonth() &&
              month.getFullYear() === selectedMonth.getFullYear()
            }
            onPress={() => setSelectedMonth(month)}
          />
        ))}
      </View>

      <FinanceCard>
        <Text
          text={`CASH FLOW · ${selectedMonth
            .toLocaleDateString("en-US", { month: "long" })
            .toUpperCase()}`}
          style={themed($eyebrow)}
        />
        <Text text={amount(summary.netBalance)} style={themed($heroAmount)} />
        <View style={themed($metricRow)}>
          <MetricPill label="Income" value={amount(summary.totalIncome)} tone="income" icon="↙" />
          <MetricPill
            label="Expenses"
            value={amount(summary.totalExpense)}
            tone="expense"
            icon="↗"
          />
          <MetricPill label="Saved" value={amount(summary.saved)} tone="saved" icon="✿" />
        </View>
        <View style={themed($savingsHeader)}>
          <Text text="Savings rate" style={themed($muted)} />
          <Text text={`${summary.savingsRate}%`} style={themed($savedPercent)} />
        </View>
        <ProgressBar value={summary.savingsRate} color="#86cdea" />
      </FinanceCard>

      <TextField value={search} onChangeText={setSearch} placeholder="Search transactions..." />

      <View style={themed($filters)}>
        {visibleFilters.map((filter) => (
          <Chip
            key={filter}
            label={filter}
            active={activeFilter === filter}
            onPress={() => setActiveFilter(filter)}
          />
        ))}
      </View>

      <SectionHeader title="Transactions" />
      {transactions.status === "loading" && <Text text="Loading Firefly transactions..." />}
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
            hideAmounts={hideAmounts}
          />
        ))}
    </Screen>
  )
}

function TransactionGroup({
  title,
  transactions,
  hideAmounts,
}: {
  title: string
  transactions: FlatTransaction[]
  hideAmounts: boolean
}) {
  const { themed } = useAppTheme()
  const summary = buildMonthlySummary(transactions)
  const net = hideAmounts
    ? maskMoney(summary.currencySymbol)
    : formatMoney(summary.netBalance, summary.currencySymbol)

  return (
    <View style={themed($group)}>
      <View style={themed($groupHeader)}>
        <Text text={title} style={themed($groupTitle)} />
        <Text text={net} style={themed($groupNet)} />
      </View>
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.journalId ?? `${transaction.groupId}-${transaction.date}`}
          transaction={transaction}
          hideAmounts={hideAmounts}
        />
      ))}
    </View>
  )
}

function TransactionRow({
  transaction,
  hideAmounts,
}: {
  transaction: FlatTransaction
  hideAmounts: boolean
}) {
  const { themed } = useAppTheme()
  const isIncome = transaction.type === "deposit"
  const icon =
    transaction.categoryName === "Transport"
      ? "⌁"
      : transaction.categoryName === "Shopping"
        ? "▣"
        : isIncome
          ? "▥"
          : "♨"

  return (
    <View style={themed($transactionRow)}>
      <View style={themed([$categoryIcon, isIncome && $incomeIcon])}>
        <Text text={icon} style={themed($categoryGlyph)} />
      </View>
      <View style={themed($transactionMain)}>
        <Text text={transaction.description} style={themed($transactionTitle)} />
        <Text
          text={`${transaction.categoryName ?? "General"} · ${transaction.sourceName} · ${new Date(
            transaction.date,
          ).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
          style={themed($muted)}
        />
        <View style={themed($tagRow)}>
          {transaction.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={themed($tag)}>
              <Text text={`#${tag}`} style={themed($tagText)} />
            </View>
          ))}
        </View>
      </View>
      <Text
        text={
          hideAmounts
            ? maskMoney(transaction.currencySymbol)
            : `${isIncome ? "+" : transaction.type === "withdrawal" ? "-" : ""}${formatMoney(
                transaction.amount,
                transaction.currencySymbol,
              )}`
        }
        style={themed([$transactionAmount, isIncome ? $incomeText : $expenseText])}
      />
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.lg,
  padding: spacing.lg,
  paddingBottom: spacing.xxxl,
})

const $topBar: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $year: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 26,
  lineHeight: 34,
})

const $topActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.md,
})

const $actionGlyph: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 26,
})

const $avatarButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 24,
  height: 48,
  justifyContent: "center",
  width: 48,
})

const $avatarGlyph: ThemedStyle<TextStyle> = () => ({
  fontSize: 20,
})

const $months: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 12,
  letterSpacing: 2,
  lineHeight: 16,
})

const $heroAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 48,
  lineHeight: 58,
  marginTop: 8,
})

const $metricRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginTop: spacing.lg,
})

const $savingsHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: spacing.lg,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  lineHeight: 20,
})

const $savedPercent: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.secondary300,
  fontFamily: typography.primary.semiBold,
})

const $filters: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $group: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

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
  fontSize: 13,
  letterSpacing: 1.3,
})

const $groupNet: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
})

const $transactionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.md,
})

const $categoryIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "#a63b08",
  borderRadius: 26,
  height: 52,
  justifyContent: "center",
  width: 52,
})

const $incomeIcon: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "rgba(62, 165, 118, 0.25)",
})

const $categoryGlyph: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 20,
})

const $transactionMain: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $transactionTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 17,
  lineHeight: 23,
})

const $tagRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  marginTop: spacing.xs,
})

const $tag: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 2,
})

const $tagText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 16,
})

const $transactionAmount: ThemedStyle<TextStyle> = ({ typography }) => ({
  fontFamily: typography.primary.semiBold,
  fontSize: 17,
})

const $incomeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})

const $expenseText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
})
