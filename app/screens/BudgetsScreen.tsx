import { FC, useMemo, useState } from "react"
import { DimensionValue, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Chip } from "@/components/firefly/FinancePrimitives"
import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { SelectionSheet } from "@/components/firefly/SelectionSheet"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import type { FireflyBudget, FireflyBudgetLimit } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import {
  BudgetPeriod,
  formatBudgetPeriodLabel,
  formatDateKey,
  formatMoney,
  maskMoney,
  parseAmount,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type BudgetsScreenProps = MainTabScreenProps<"Budgets">

type BudgetSummary = {
  budget: FireflyBudget
  allocated: number
  spent: number
  remaining: number
  symbol: string
  currencyCode?: string
  hasLimit: boolean
  progress: number
  limits: FireflyBudgetLimit[]
}

const periodFilters: { key: BudgetPeriod; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
]

const iconConfig = [
  { icon: "silverware-fork-knife", tone: "green" },
  { icon: "car-outline", tone: "blue" },
  { icon: "home-outline", tone: "neutral" },
  { icon: "shopping-outline", tone: "red" },
  { icon: "heart-pulse", tone: "green" },
  { icon: "lightning-bolt-outline", tone: "blue" },
] as const

const formatAmount = (amount: number, symbol: string, hidden: boolean) =>
  hidden ? maskMoney(symbol) : formatMoney(amount, symbol)
const dateKeyFromString = (value: string) => value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
const normalizeDateKey = (value: string) => dateKeyFromString(value) ?? formatDateKey(new Date())
const formatRange = (start: string, end: string) =>
  `${normalizeDateKey(start)} - ${normalizeDateKey(end)}`

function rangeForLimits(
  limits: FireflyBudgetLimit[],
  fallbackRange: { start: string; end: string },
) {
  if (limits.length === 0) return fallbackRange
  const starts = limits.map((limit) => normalizeDateKey(limit.attributes.start)).sort()
  const ends = limits.map((limit) => normalizeDateKey(limit.attributes.end)).sort()
  return { start: starts[0], end: ends[ends.length - 1] }
}

export const BudgetsScreen: FC<BudgetsScreenProps> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    isConfigured,
    hideAmounts,
    budgets,
    budgetLimits,
    selectedBudgetPeriod,
    selectedBudgetAnchor,
    budgetRange,
    isBudgetPeriodLoading,
    isRefreshing,
    setSelectedBudgetPeriod,
    previousBudgetPeriod,
    nextBudgetPeriod,
    resetBudgetMutation,
    refresh,
  } = useFirefly()
  const [search, setSearch] = useState("")
  const [limitSelectorSummary, setLimitSelectorSummary] = useState<BudgetSummary>()

  const summaries = useMemo(
    () => buildBudgetSummaries(budgets.data, budgetLimits.data),
    [budgetLimits.data, budgets.data],
  )
  const normalizedSearch = search.trim().toLowerCase()
  const visibleSummaries = summaries.filter((summary) => {
    if (!normalizedSearch) return true
    return [
      summary.budget.attributes.name,
      summary.budget.attributes.notes,
      summary.currencyCode,
      String(summary.allocated),
      String(summary.spent),
      String(summary.remaining),
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch))
  })
  const totals = visibleSummaries.reduce(
    (result, summary) => ({
      allocated: result.allocated + summary.allocated,
      spent: result.spent + summary.spent,
      remaining: result.remaining + summary.remaining,
      symbol: result.symbol || summary.symbol,
    }),
    { allocated: 0, spent: 0, remaining: 0, symbol: summaries[0]?.symbol ?? "৳" },
  )

  const openFireflySettings = () => navigation.navigate("Settings", { screen: "SettingsFirefly" })

  function openEditor() {
    if (!isConfigured) {
      openFireflySettings()
      return
    }
    resetBudgetMutation()
    navigation.navigate("BudgetEditor")
  }

  function openSummary(summary: BudgetSummary) {
    resetBudgetMutation()
    if (summary.limits.length <= 1) {
      navigation.navigate("BudgetEditor", {
        budgetId: summary.budget.id,
        limitId: summary.limits[0]?.id,
      })
      return
    }
    setLimitSelectorSummary(summary)
  }

  return (
    <>
      <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
        <View style={themed($header)}>
          <View>
            <Text text="Budgets" style={themed($title)} />
            <Text
              text={formatBudgetPeriodLabel(selectedBudgetAnchor, selectedBudgetPeriod)}
              style={themed($muted)}
            />
          </View>
          <Pressable
            accessibilityLabel="Add budget"
            accessibilityRole="button"
            onPress={openEditor}
            style={themed($add)}
          >
            <MaterialCommunityIcons name="plus" color={colors.palette.surfaceDim} size={26} />
          </Pressable>
        </View>

        <View style={themed($periodRow)}>
          <Pressable
            accessibilityLabel="Previous budget period"
            accessibilityRole="button"
            onPress={previousBudgetPeriod}
            style={themed($periodButton)}
          >
            <MaterialCommunityIcons name="chevron-left" color={colors.text} size={22} />
          </Pressable>
          <View style={themed($periodTabs)}>
            {periodFilters.map((filter) => (
              <Chip
                key={filter.key}
                label={filter.label}
                active={selectedBudgetPeriod === filter.key}
                onPress={() => setSelectedBudgetPeriod(filter.key)}
              />
            ))}
          </View>
          <Pressable
            accessibilityLabel="Next budget period"
            accessibilityRole="button"
            onPress={nextBudgetPeriod}
            style={themed($periodButton)}
          >
            <MaterialCommunityIcons name="chevron-right" color={colors.text} size={22} />
          </Pressable>
        </View>

        <View style={themed($summaryCard)}>
          <View style={themed($summaryHeader)}>
            <Text text={budgetRange.start.toUpperCase()} style={themed($eyebrow)} />
            <Text
              text={`${formatAmount(totals.remaining, totals.symbol, hideAmounts)} left`}
              style={themed(totals.remaining < 0 ? $negative : $positive)}
            />
          </View>
          <ProgressBar
            value={totals.allocated > 0 ? totals.spent / totals.allocated : 0}
            tone={totals.remaining < 0 ? "danger" : "blue"}
          />
          <View style={themed($metrics)}>
            <Metric
              label="Allocated"
              value={formatAmount(totals.allocated, totals.symbol, hideAmounts)}
            />
            <Metric
              label="Spent"
              value={formatAmount(totals.spent, totals.symbol, hideAmounts)}
              tone="expense"
            />
            <Metric
              label="Remaining"
              value={formatAmount(totals.remaining, totals.symbol, hideAmounts)}
              tone={totals.remaining < 0 ? "danger" : "positive"}
            />
          </View>
        </View>

        <TextField
          accessibilityLabel="Search budgets"
          value={search}
          onChangeText={setSearch}
          placeholder="Search budgets"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={themed($searchContainer)}
          inputWrapperStyle={themed($searchInputWrapper)}
          style={themed($searchInput)}
          LeftAccessory={({ style }) => (
            <View style={[style, themed($searchAccessory)]}>
              <MaterialCommunityIcons name="magnify" color={colors.textDim} size={21} />
            </View>
          )}
          RightAccessory={
            search
              ? ({ style }) => (
                  <Pressable
                    accessibilityLabel="Clear budget search"
                    onPress={() => setSearch("")}
                    style={[style, themed($searchAccessory)]}
                  >
                    <MaterialCommunityIcons name="close" color={colors.textDim} size={19} />
                  </Pressable>
                )
              : undefined
          }
        />

        {(isRefreshing || isBudgetPeriodLoading) && budgets.data.length > 0 ? (
          <LoadingIndicator label="Refreshing budgets..." compact />
        ) : null}

        <Text text="ALL BUDGETS" style={themed($sectionLabel)} />
        {visibleSummaries.map((summary, index) => (
          <BudgetCard
            key={summary.budget.id}
            summary={summary}
            hidden={hideAmounts}
            iconIndex={index}
            fallbackRange={budgetRange}
            onPress={() => openSummary(summary)}
          />
        ))}

        {budgets.status === "loading" && budgets.data.length === 0 ? (
          <LoadingIndicator label="Loading budgets..." />
        ) : null}
        {budgets.status !== "loading" && budgets.data.length === 0 ? (
          <Text text="No budgets were returned by Firefly." style={themed($empty)} />
        ) : null}
        {budgets.data.length > 0 && visibleSummaries.length === 0 ? (
          <Text
            text={
              normalizedSearch
                ? `No budgets match "${search.trim()}".`
                : "No budgets match this filter."
            }
            style={themed($empty)}
          />
        ) : null}
        {budgets.error || budgetLimits.error ? (
          <Text
            text={`${(budgets.error ?? budgetLimits.error)?.message} Tap to retry.`}
            onPress={() => (isConfigured ? void refresh() : openFireflySettings())}
            style={themed($negative)}
          />
        ) : null}
      </Screen>

      <SelectionSheet
        visible={!!limitSelectorSummary}
        title="Budget Limit"
        items={(limitSelectorSummary?.limits ?? []).map((limit) => ({
          id: limit.id,
          title: formatRange(limit.attributes.start, limit.attributes.end),
          subtitle: formatAmount(
            parseAmount(limit.attributes.pc_amount ?? limit.attributes.amount),
            limit.attributes.currency_symbol ?? limitSelectorSummary?.symbol ?? "৳",
            hideAmounts,
          ),
          icon: "calendar-range-outline",
        }))}
        selectedIds={[]}
        onSelect={(ids) => {
          const limit = limitSelectorSummary?.limits.find((item) => item.id === ids[0])
          if (!limitSelectorSummary || !limit) return
          setLimitSelectorSummary(undefined)
          navigation.navigate("BudgetEditor", {
            budgetId: limitSelectorSummary.budget.id,
            limitId: limit.id,
          })
        }}
        onClose={() => setLimitSelectorSummary(undefined)}
      />
    </>
  )
}

function BudgetCard({
  summary,
  hidden,
  iconIndex,
  fallbackRange,
  onPress,
}: {
  summary: BudgetSummary
  hidden: boolean
  iconIndex: number
  fallbackRange: { start: string; end: string }
  onPress: () => void
}) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const config = iconConfig[iconIndex % iconConfig.length]
  const overBudget = summary.remaining < 0
  const cardRange = rangeForLimits(summary.limits, fallbackRange)
  const rangeText = formatRange(cardRange.start, cardRange.end)

  return (
    <Pressable
      accessibilityLabel={`Edit ${summary.budget.attributes.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={themed($budgetCard)}
    >
      <View style={themed($budgetTop)}>
        <View style={themed([$budgetIcon, $budgetIconTone[config.tone]])}>
          <MaterialCommunityIcons name={config.icon} color={colors.palette.surfaceDim} size={18} />
        </View>
        <View style={themed($budgetNameGroup)}>
          <Text
            text={summary.budget.attributes.name}
            numberOfLines={1}
            style={themed($budgetName)}
          />
          <Text text={rangeText} numberOfLines={1} style={themed($muted)} />
        </View>
        <MaterialCommunityIcons name="chevron-right" color={colors.textDim} size={20} />
      </View>
      <ProgressBar
        value={summary.progress}
        tone={overBudget ? "danger" : summary.remaining === 0 ? "blue" : "primary"}
      />
      <View style={themed($metrics)}>
        <Metric
          label="Spent"
          value={formatAmount(summary.spent, summary.symbol, hidden)}
          tone="expense"
        />
        <Metric label="Budget" value={formatAmount(summary.allocated, summary.symbol, hidden)} />
        <Metric
          label="Remaining"
          value={formatAmount(summary.remaining, summary.symbol, hidden)}
          tone={overBudget ? "danger" : "positive"}
        />
      </View>
    </Pressable>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "positive" | "danger" | "expense"
}) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($metric)}>
      <Text text={label} style={themed($metricLabel)} />
      <Text
        text={value}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        style={themed([
          tone === "positive"
            ? $positive
            : tone === "danger" || tone === "expense"
              ? $negative
              : $metricValue,
        ])}
      />
    </View>
  )
}

function ProgressBar({ value, tone }: { value: number; tone: "primary" | "blue" | "danger" }) {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const width = `${Math.max(0, Math.min(100, value * 100))}%` as DimensionValue
  const backgroundColor =
    tone === "danger"
      ? colors.palette.tertiary300
      : tone === "blue"
        ? colors.palette.secondary300
        : colors.tint

  return (
    <View style={themed($progressTrack)}>
      <View style={[themed($progressFill), { backgroundColor, width }]} />
    </View>
  )
}

function buildBudgetSummaries(
  budgets: FireflyBudget[],
  limits: FireflyBudgetLimit[],
): BudgetSummary[] {
  return budgets
    .filter((budget) => budget.attributes.active !== false)
    .map((budget) => {
      const budgetLimits = limits.filter((limit) => limit.attributes.budget_id === budget.id)
      const hasLimit = budgetLimits.length > 0
      const allocated = budgetLimits.reduce(
        (total, limit) =>
          total + parseAmount(limit.attributes.pc_amount ?? limit.attributes.amount),
        0,
      )
      const spent = hasLimit
        ? budgetLimits.reduce((total, limit) => total + sumSpent(limit.attributes), 0)
        : sumSpent(budget.attributes)
      const spentEntry =
        budgetLimits.flatMap(
          (limit) => limit.attributes.pc_spent ?? limit.attributes.spent ?? [],
        )[0] ??
        budget.attributes.pc_spent?.[0] ??
        budget.attributes.spent?.[0]
      const symbol =
        spentEntry?.currency_symbol ??
        budgetLimits[0]?.attributes.currency_symbol ??
        budget.attributes.currency_symbol ??
        "৳"
      const currencyCode =
        spentEntry?.currency_code ??
        budgetLimits[0]?.attributes.currency_code ??
        budget.attributes.currency_code
      const progress = allocated > 0 ? spent / allocated : 0
      return {
        budget,
        allocated,
        spent,
        remaining: allocated - spent,
        symbol,
        currencyCode,
        hasLimit,
        progress,
        limits: budgetLimits,
      }
    })
    .sort((left, right) => {
      if (left.hasLimit !== right.hasLimit) return left.hasLimit ? -1 : 1
      return right.spent - left.spent
    })
}

function sumSpent(attributes: Pick<FireflyBudget["attributes"], "spent" | "pc_spent">) {
  const entries = attributes.pc_spent?.length ? attributes.pc_spent : attributes.spent
  return entries?.reduce((total, entry) => total + Math.abs(parseAmount(entry.sum)), 0) ?? 0
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  padding: spacing.md,
  paddingBottom: 112,
})
const $header: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 32,
  lineHeight: 38,
})
const $add: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.tint,
  borderRadius: 22,
  height: 44,
  justifyContent: "center",
  width: 44,
})
const $periodRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
})
const $periodTabs: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "center",
})
const $periodButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderColor: colors.palette.stroke,
  borderRadius: 18,
  borderWidth: 1,
  height: 36,
  justifyContent: "center",
  width: 36,
})
const $summaryCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 28,
  borderWidth: 1,
  gap: spacing.md,
  padding: spacing.lg,
})
const $summaryHeader: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})
const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 11,
  letterSpacing: 2,
  lineHeight: 16,
})
const $metrics: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "space-between",
})
const $metric: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  minWidth: 0,
})
const $metricLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 17,
})
const $metricValue: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})
const $positive: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})
const $negative: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})
const $progressTrack: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 999,
  height: 9,
  overflow: "hidden",
})
const $progressFill: ThemedStyle<ViewStyle> = () => ({
  borderRadius: 999,
  height: "100%",
})
const $searchContainer: ThemedStyle<ViewStyle> = () => ({ width: "100%" })
const $searchInputWrapper: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 16,
  height: 44,
})
const $searchInput: ThemedStyle<TextStyle> = ({ colors }) => ({
  alignSelf: "center",
  color: colors.text,
  fontSize: 14,
  height: 44,
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
const $sectionLabel: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 12,
  letterSpacing: 2,
  lineHeight: 16,
  marginTop: 4,
})
const $budgetCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  borderWidth: 1,
  gap: spacing.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
})
const $budgetTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
})
const $budgetIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  borderRadius: 18,
  height: 36,
  justifyContent: "center",
  width: 36,
})
const $budgetIconTone: Record<(typeof iconConfig)[number]["tone"], ThemedStyle<ViewStyle>> = {
  green: ({ colors }) => ({ backgroundColor: colors.tint }),
  blue: ({ colors }) => ({ backgroundColor: colors.palette.secondary300 }),
  neutral: ({ colors }) => ({ backgroundColor: colors.palette.neutral400 }),
  red: ({ colors }) => ({ backgroundColor: colors.palette.tertiary300 }),
}
const $budgetNameGroup: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  minWidth: 0,
})
const $budgetName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 17,
})
const $empty: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  paddingVertical: spacing.md,
  textAlign: "center",
})
