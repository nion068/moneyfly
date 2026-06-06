import { FC, useState } from "react"
import { TextStyle, View, ViewStyle } from "react-native"

import { Chip, FinanceCard, SectionHeader } from "@/components/firefly/FinancePrimitives"
import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useFirefly } from "@/context/FireflyContext"
import type { AccountSummary } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { accountToSummary, formatMoney } from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type AccountsScreenProps = MainTabScreenProps<"Accounts">

const filters = ["All", "Bank", "Wallet", "Cash", "Credit"]

export const AccountsScreen: FC<AccountsScreenProps> = () => {
  const { themed } = useAppTheme()
  const {
    accounts: accountState,
    transactions,
    selectedMonth,
    refresh,
    isRefreshing,
  } = useFirefly()
  const [activeFilter, setActiveFilter] = useState("All")
  const activeAccounts = accountState.data.filter((account) => {
    const type = account.attributes.type.toLowerCase()
    return (
      account.attributes.active !== false &&
      (type.includes("asset") || type.includes("cash") || type.includes("liabilit"))
    )
  })
  const accountSummaries = activeAccounts.map((account) =>
    accountToSummary(account, transactions.data),
  )
  const netWorthByCurrency = accountSummaries.reduce<
    Record<string, { amount: number; symbol: string }>
  >((result, account) => {
    const code =
      activeAccounts.find((item) => item.id === account.id)?.attributes.currency_code ?? "Unknown"
    const current = result[code] ?? { amount: 0, symbol: account.currencySymbol }
    result[code] = { ...current, amount: current.amount + account.balance }
    return result
  }, {})

  const accounts =
    activeFilter === "All"
      ? accountSummaries
      : accountSummaries.filter((account) => account.type === activeFilter.toLowerCase())

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($header)}>
        <View>
          <Text text="Accounts" style={themed($title)} />
          <Text
            text={selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            style={themed($muted)}
          />
        </View>
        <View style={themed($headerActions)}>
          <Text text="⌕" style={themed($roundAction)} />
          <Text text="+" style={themed($addAction)} />
        </View>
      </View>

      <FinanceCard>
        <View style={themed($summaryRow)}>
          <View>
            <Text text="NET WORTH" style={themed($eyebrow)} />
            {Object.entries(netWorthByCurrency).map(([code, value]) => (
              <Text
                key={code}
                text={`${code} ${formatMoney(value.amount, value.symbol)}`}
                style={themed($heroAmount)}
              />
            ))}
            {Object.keys(netWorthByCurrency).length === 0 && (
              <Text text="No active accounts" style={themed($muted)} />
            )}
          </View>
          <View style={themed($walletBadge)}>
            <Text text="▣" style={themed($walletGlyph)} />
            <Text text={`${activeAccounts.length} accounts`} style={themed($muted)} />
          </View>
        </View>
      </FinanceCard>

      <SectionHeader title="All Accounts" action="Sort ⌄" />
      {isRefreshing && <LoadingIndicator label="Refreshing accounts..." compact />}
      <View style={themed($filters)}>
        {filters.map((filter) => (
          <Chip
            key={filter}
            label={filter}
            active={activeFilter === filter}
            onPress={() => setActiveFilter(filter)}
          />
        ))}
      </View>

      {accountState.status === "loading" && accountState.data.length === 0 && (
        <LoadingIndicator label="Loading accounts..." />
      )}
      {accountState.status === "error" && (
        <Text
          text={`${accountState.error?.message} Tap refresh in Settings to retry.`}
          style={themed($negative)}
          onPress={() => void refresh()}
        />
      )}
      {accountState.status !== "loading" && accounts.length === 0 && (
        <Text text="No accounts match this filter." style={themed($muted)} />
      )}
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </Screen>
  )
}

function AccountCard({ account }: { account: AccountSummary }) {
  const { themed } = useAppTheme()
  const isPositive = account.movement >= 0

  return (
    <FinanceCard style={themed($accountCardOverride)}>
      <View style={themed($accountTop)}>
        <View style={themed([$accountIcon, account.type === "credit" && $creditIcon])}>
          <Text
            text={
              account.type === "bank"
                ? "▥"
                : account.type === "wallet"
                  ? "▯"
                  : account.type === "cash"
                    ? "▭"
                    : "▬"
            }
            style={themed($accountGlyph)}
          />
        </View>
        <View style={themed($accountInfo)}>
          <Text text={account.name} style={themed($accountName)} />
          <Text text={account.detail} style={themed($muted)} />
        </View>
        <View style={themed($accountBalance)}>
          <Text
            text={formatMoney(account.balance, account.currencySymbol)}
            style={themed($balanceText)}
          />
          <Text
            text={`${isPositive ? "+" : "-"}${formatMoney(Math.abs(account.movement), account.currencySymbol)}`}
            style={themed(isPositive ? $positive : $negative)}
          />
        </View>
      </View>

      {account.bars.length > 0 && (
        <View style={themed($miniBars)}>
          {account.bars.map((bar, index) => (
            <View key={`${account.id}-${index}`} style={themed($miniBarTrack)}>
              <View style={[themed($miniBarFill), { height: `${Math.round(bar * 100)}%` }]} />
            </View>
          ))}
        </View>
      )}

      <View style={themed($accountFooter)}>
        <Text text={`● ${account.activeLabel}`} style={themed($activeLabel)} />
        <Text text="View ›" style={themed($muted)} />
      </View>
    </FinanceCard>
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
  fontSize: 42,
  lineHeight: 50,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 15,
  lineHeight: 21,
})

const $headerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.md,
})

const $roundAction: ThemedStyle<TextStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 26,
  borderWidth: 1,
  color: colors.text,
  fontSize: 26,
  height: 52,
  lineHeight: 52,
  overflow: "hidden",
  textAlign: "center",
  width: 52,
})

const $addAction: ThemedStyle<TextStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderRadius: 26,
  color: colors.palette.surfaceDim,
  fontFamily: "spaceGroteskBold",
  fontSize: 32,
  height: 52,
  lineHeight: 52,
  overflow: "hidden",
  textAlign: "center",
  width: 52,
})

const $summaryRow: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "space-between",
})

const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 13,
  letterSpacing: 3,
  lineHeight: 18,
})

const $heroAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 44,
  lineHeight: 54,
})

const $positive: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.medium,
})

const $negative: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.medium,
})

const $walletBadge: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.sm,
})

const $walletGlyph: ThemedStyle<TextStyle> = ({ colors }) => ({
  backgroundColor: "rgba(62, 165, 118, 0.18)",
  borderRadius: 42,
  color: colors.tint,
  fontSize: 34,
  height: 84,
  lineHeight: 84,
  overflow: "hidden",
  textAlign: "center",
  width: 84,
})

const $filters: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $accountCardOverride: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: 0,
  paddingHorizontal: 0,
  paddingTop: spacing.lg,
})

const $accountTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.md,
  paddingHorizontal: spacing.lg,
})

const $accountIcon: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  backgroundColor: "rgba(134, 205, 234, 0.16)",
  borderRadius: 36,
  height: 72,
  justifyContent: "center",
  width: 72,
})

const $creditIcon: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "rgba(216, 113, 98, 0.18)",
})

const $accountGlyph: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.secondary300,
  fontSize: 28,
})

const $accountInfo: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $accountName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 20,
  lineHeight: 27,
})

const $accountBalance: ThemedStyle<ViewStyle> = () => ({
  alignItems: "flex-end",
})

const $balanceText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 21,
  lineHeight: 28,
})

const $miniBars: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "flex-end",
  flexDirection: "row",
  gap: spacing.xs,
  height: 70,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
})

const $miniBarTrack: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 10,
  flex: 1,
  height: 48,
  justifyContent: "flex-end",
  overflow: "hidden",
})

const $miniBarFill: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  borderRadius: 10,
  minHeight: 8,
})

const $accountFooter: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: spacing.md,
  padding: spacing.md,
})

const $activeLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 14,
})
