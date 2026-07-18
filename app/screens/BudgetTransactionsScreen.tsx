import { FC, useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useFirefly } from "@/context/FireflyContext"
import type { FlatTransaction } from "@/models/firefly"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { FireflyApi, FireflyProblem } from "@/services/firefly/api"
import {
  flattenFireflyTransactions,
  formatMoney,
  getTransactionIconName,
  groupTransactionsByDate,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type BudgetTransactionsScreenProps = AppStackScreenProps<"BudgetTransactions">

type LoadState = {
  data: FlatTransaction[]
  status: "idle" | "loading" | "ready" | "error"
  error?: FireflyProblem | Error
}

export const BudgetTransactionsScreen: FC<BudgetTransactionsScreenProps> = ({
  navigation,
  route,
}) => {
  const { themed } = useAppTheme()
  const { baseUrl, token, isConfigured, hideAmounts } = useFirefly()
  const { budgetId, budgetName, range, allocated, symbol } = route.params
  const [state, setState] = useState<LoadState>({ data: [], status: "idle" })

  const load = useCallback(async () => {
    if (!isConfigured) return
    setState((current) => ({ ...current, status: "loading", error: undefined }))
    const result = await new FireflyApi(baseUrl, token).getTransactions({
      start: range.start,
      end: range.end,
      type: "withdrawal",
    })
    if (result.kind !== "ok") {
      setState((current) => ({ ...current, status: "error", error: result }))
      return
    }
    const data = flattenFireflyTransactions(result.data)
      .filter((transaction) => transaction.budgetId === budgetId)
      .sort((left, right) => right.date.localeCompare(left.date))
    setState({ data, status: "ready" })
  }, [baseUrl, budgetId, isConfigured, range.end, range.start, token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isConfigured) {
      navigation.replace("Main", {
        screen: "Settings",
        params: { screen: "SettingsFirefly" },
      })
    }
  }, [isConfigured, navigation])

  const groupedTransactions = useMemo(() => groupTransactionsByDate(state.data), [state.data])
  const spent = state.data.reduce((total, transaction) => total + transaction.amount, 0)
  const remaining = allocated - spent
  const progress = allocated > 0 ? spent / allocated : 0
  const formatAmount = (value: number) =>
    hideAmounts ? `${symbol} ••••••` : formatMoney(value, symbol)

  if (!isConfigured) return null

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($header)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={themed($roundButton)}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} style={themed($icon)} />
        </Pressable>
        <View style={themed($titleGroup)}>
          <Text text={budgetName} style={themed($title)} numberOfLines={1} />
          <Text text={`${range.start} - ${range.end}`} style={themed($muted)} numberOfLines={1} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry budget transactions"
          onPress={() => void load()}
          style={themed($roundButton)}
        >
          <MaterialCommunityIcons name="refresh" size={22} style={themed($icon)} />
        </Pressable>
      </View>

      <View style={themed($summaryCard)}>
        <View style={themed($summaryHeader)}>
          <Text text={`${state.data.length} TRANSACTIONS`} style={themed($eyebrow)} />
          <Text
            text={`${formatAmount(remaining)} left`}
            style={themed(remaining < 0 ? $negative : $positive)}
          />
        </View>
        <View style={themed($progressTrack)}>
          <View
            style={[
              themed($progressFill),
              {
                width: `${Math.max(0, Math.min(100, progress * 100))}%`,
              },
              themed(remaining < 0 ? $dangerProgress : $primaryProgress),
            ]}
          />
        </View>
        <View style={themed($metrics)}>
          <Metric label="Spent" value={formatAmount(spent)} tone="expense" />
          <Metric label="Budget" value={formatAmount(allocated)} />
          <Metric
            label="Remaining"
            value={formatAmount(remaining)}
            tone={remaining < 0 ? "danger" : "positive"}
          />
        </View>
      </View>

      {state.status === "loading" ? <LoadingIndicator label="Loading transactions..." /> : null}
      {state.status === "error" ? (
        <Text
          text={`${state.error?.message ?? "Could not load transactions."} Tap retry.`}
          style={themed($error)}
          onPress={() => void load()}
        />
      ) : null}
      {state.status !== "loading" && state.data.length === 0 ? (
        <Text text="No transactions found for this budget." style={themed($empty)} />
      ) : null}

      {Object.entries(groupedTransactions)
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([date, transactions]) => (
          <View key={date} style={themed($group)}>
            <Text
              text={new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              style={themed($groupTitle)}
            />
            {transactions.map((transaction) => (
              <BudgetTransactionRow
                key={transaction.journalId ?? `${transaction.groupId}-${transaction.date}`}
                transaction={transaction}
                onPress={() => navigation.navigate("TransactionDetails", { transaction })}
              />
            ))}
          </View>
        ))}
    </Screen>
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

function BudgetTransactionRow({
  transaction,
  onPress,
}: {
  transaction: FlatTransaction
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${transaction.description}`}
      onPress={onPress}
      style={themed($transactionRow)}
    >
      <View style={themed($categoryIcon)}>
        <MaterialCommunityIcons
          name={getTransactionIconName(transaction) as keyof typeof MaterialCommunityIcons.glyphMap}
          size={20}
          style={themed($icon)}
        />
      </View>
      <View style={themed($transactionMain)}>
        <Text text={transaction.description} style={themed($transactionTitle)} numberOfLines={1} />
        <Text
          text={`${transaction.categoryName ?? "General"} · ${transaction.sourceName}`}
          style={themed($muted)}
          numberOfLines={1}
        />
      </View>
      <Text
        text={`-${formatMoney(transaction.amount, transaction.currencySymbol)}`}
        style={themed($transactionAmount)}
      />
    </Pressable>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  padding: spacing.md,
  paddingBottom: 112,
})
const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
})
const $roundButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 20,
  height: 40,
  justifyContent: "center",
  width: 40,
})
const $titleGroup: ThemedStyle<ViewStyle> = () => ({ flex: 1, minWidth: 0 })
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 24,
  lineHeight: 30,
})
const $summaryCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
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
const $primaryProgress: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
})
const $dangerProgress: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.tertiary300,
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
const $group: ThemedStyle<ViewStyle> = ({ spacing }) => ({ gap: spacing.xs })
const $groupTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
  marginTop: 4,
})
const $transactionRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 12,
  borderWidth: 1,
  flexDirection: "row",
  gap: spacing.sm,
  padding: spacing.sm,
})
const $categoryIcon: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 18,
  height: 36,
  justifyContent: "center",
  width: 36,
})
const $transactionMain: ThemedStyle<ViewStyle> = () => ({ flex: 1, minWidth: 0 })
const $transactionTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})
const $transactionAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
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
const $error: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.tertiary300,
  textAlign: "center",
})
const $icon: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })
