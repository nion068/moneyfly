import { FC, useState } from "react"
import { Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Chip } from "@/components/firefly/FinancePrimitives"
import { LoadingIndicator } from "@/components/firefly/LoadingIndicator"
import { Screen } from "@/components/Screen"
import { SettingsEditorModal } from "@/components/settings/SettingsEditorModal"
import { SettingsCard, SettingsIcon } from "@/components/settings/SettingsPrimitives"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import type { FireflyAccount } from "@/models/firefly"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import {
  accountGroupFor,
  accountWritableType,
  formatMoney,
  isOwnedAccount,
  type AccountGroup,
} from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type AccountsScreenProps = MainTabScreenProps<"Accounts">
type AccountFilter = "all" | AccountGroup

const filters: { key: AccountFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "asset", label: "Asset" },
  { key: "expense", label: "Expense" },
  { key: "revenue", label: "Revenue" },
  { key: "liability", label: "Liability" },
]

const groups: AccountGroup[] = ["asset", "expense", "revenue", "liability"]

const groupConfig: Record<
  AccountGroup,
  {
    title: string
    icon: "bank-outline" | "cart-outline" | "trending-up" | "credit-card-outline"
  }
> = {
  asset: { title: "Asset Accounts", icon: "bank-outline" },
  expense: { title: "Expense Accounts", icon: "cart-outline" },
  revenue: { title: "Revenue Accounts", icon: "trending-up" },
  liability: { title: "Liabilities", icon: "credit-card-outline" },
}

export const AccountsScreen: FC<AccountsScreenProps> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    isConfigured,
    accounts: accountState,
    selectedCurrency,
    settingsMutation,
    saveAccount,
    refresh,
    isRefreshing,
  } = useFirefly()
  const [activeFilter, setActiveFilter] = useState<AccountFilter>("all")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<FireflyAccount | null>()
  const [editorVisible, setEditorVisible] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("asset")
  const [currency, setCurrency] = useState(selectedCurrency ?? "USD")
  const [expandedGroups, setExpandedGroups] = useState<Record<AccountGroup, boolean>>({
    asset: true,
    expense: true,
    revenue: true,
    liability: true,
  })

  const manageableAccounts = accountState.data.filter(
    (account) => accountGroupFor(account) !== null,
  )
  const ownedAccounts = accountState.data.filter(isOwnedAccount)
  const netWorthByCurrency = ownedAccounts.reduce<
    Record<string, { amount: number; symbol: string }>
  >((result, account) => {
    const code = account.attributes.currency_code ?? "Unknown"
    const current = result[code] ?? {
      amount: 0,
      symbol: account.attributes.currency_symbol ?? "",
    }
    const rawBalance = account.attributes.current_balance ?? account.attributes.balance
    const balance = Number(rawBalance ?? 0)
    result[code] = {
      ...current,
      amount: current.amount + (Number.isFinite(balance) ? balance : 0),
    }
    return result
  }, {})
  const normalizedSearch = search.trim().toLowerCase()
  const visibleAccounts = manageableAccounts.filter((account) => {
    const group = accountGroupFor(account)
    if (activeFilter !== "all" && group !== activeFilter) return false
    if (!normalizedSearch) return true
    return [
      account.attributes.name,
      account.attributes.account_role,
      account.attributes.type,
      account.attributes.currency_code,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch))
  })
  const visibleGroups = activeFilter === "all" ? groups : [activeFilter]

  const openFireflySettings = () => navigation.navigate("Settings", { screen: "SettingsFirefly" })

  function openEditor(account?: FireflyAccount) {
    if (!isConfigured) {
      openFireflySettings()
      return
    }
    setEditing(account ?? null)
    setName(account?.attributes.name ?? "")
    setType(account ? accountWritableType(account) : "asset")
    setCurrency(account?.attributes.currency_code ?? selectedCurrency ?? "USD")
    setEditorVisible(true)
  }

  async function save() {
    const ok = await saveAccount(
      {
        name: name.trim(),
        type: type.trim().toLowerCase(),
        currency_code: currency.trim().toUpperCase(),
        active: editing?.attributes.active !== false,
      },
      editing?.id,
    )
    if (ok) setEditorVisible(false)
  }

  function toggleGroup(group: AccountGroup) {
    setExpandedGroups((current) => ({ ...current, [group]: !current[group] }))
  }

  return (
    <>
      <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
        <View style={themed($header)}>
          <Text text="Accounts" style={themed($title)} />
          <Pressable
            accessibilityLabel="Add account"
            accessibilityRole="button"
            onPress={() => openEditor()}
            style={themed($add)}
          >
            <MaterialCommunityIcons name="plus" color={colors.palette.surfaceDim} size={26} />
          </Pressable>
        </View>

        <SettingsCard style={themed($netWorthCard)}>
          <View style={themed($netWorthCopy)}>
            <Text text="NET WORTH" style={themed($eyebrow)} />
            {Object.entries(netWorthByCurrency).map(([code, value]) => (
              <Text
                key={code}
                text={formatMoney(value.amount, value.symbol)}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
                style={themed($heroAmount)}
              />
            ))}
            {Object.keys(netWorthByCurrency).length === 0 ? (
              <Text text="No active accounts" style={themed($muted)} />
            ) : null}
          </View>
          <View style={themed($accountCount)}>
            <SettingsIcon name="wallet-outline" tone="primary" size={22} />
            <Text text={`${ownedAccounts.length} accounts`} style={themed($muted)} />
          </View>
        </SettingsCard>

        <TextField
          accessibilityLabel="Search accounts"
          value={search}
          onChangeText={setSearch}
          placeholder="Search accounts"
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
                    accessibilityLabel="Clear account search"
                    onPress={() => setSearch("")}
                    style={[style, themed($searchAccessory)]}
                  >
                    <MaterialCommunityIcons name="close" color={colors.textDim} size={19} />
                  </Pressable>
                )
              : undefined
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={themed($filters)}
        >
          {filters.map((filter) => (
            <Chip
              key={filter.key}
              label={filter.label}
              active={activeFilter === filter.key}
              onPress={() => setActiveFilter(filter.key)}
            />
          ))}
        </ScrollView>

        {isRefreshing ? <LoadingIndicator label="Refreshing accounts..." compact /> : null}

        {visibleGroups.map((group) => {
          const items = visibleAccounts.filter((account) => accountGroupFor(account) === group)
          if (items.length === 0) return null
          const config = groupConfig[group]
          const expanded = expandedGroups[group]
          return (
            <SettingsCard key={group} style={themed($group)}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => toggleGroup(group)}
                style={themed($groupHeader)}
              >
                <SettingsIcon
                  name={config.icon}
                  tone={group === "asset" ? "primary" : group === "revenue" ? "blue" : "neutral"}
                  size={19}
                />
                <Text text={config.title} style={themed($groupTitle)} />
                <Text text={String(items.length)} style={themed($muted)} />
                <MaterialCommunityIcons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  color={colors.textDim}
                  size={21}
                />
              </Pressable>
              {expanded
                ? items.map((account) => {
                    const rawBalance =
                      account.attributes.current_balance ?? account.attributes.balance
                    const balance = rawBalance !== undefined ? Number(rawBalance) : undefined
                    return (
                      <View key={account.id} style={themed($accountRow)}>
                        <View style={themed($accountCopy)}>
                          <Text text={account.attributes.name} style={themed($accountName)} />
                          <Text
                            text={account.attributes.account_role ?? account.attributes.type}
                            numberOfLines={1}
                            style={themed($muted)}
                          />
                        </View>
                        {balance !== undefined && Number.isFinite(balance) ? (
                          <Text
                            text={formatMoney(balance, account.attributes.currency_symbol ?? "")}
                            numberOfLines={1}
                            style={themed(balance < 0 ? $negative : $balance)}
                          />
                        ) : null}
                        <Pressable
                          accessibilityLabel={`Edit ${account.attributes.name}`}
                          accessibilityRole="button"
                          onPress={() => openEditor(account)}
                          style={themed($edit)}
                        >
                          <MaterialCommunityIcons
                            name="pencil-outline"
                            color={colors.textDim}
                            size={18}
                          />
                        </Pressable>
                      </View>
                    )
                  })
                : null}
            </SettingsCard>
          )
        })}

        {accountState.status === "loading" && manageableAccounts.length === 0 ? (
          <LoadingIndicator label="Loading accounts..." />
        ) : null}
        {accountState.status !== "loading" && manageableAccounts.length === 0 ? (
          <Text text="No manageable accounts were returned by Firefly." style={themed($empty)} />
        ) : null}
        {accountState.status !== "loading" &&
        manageableAccounts.length > 0 &&
        visibleAccounts.length === 0 ? (
          <Text
            text={
              normalizedSearch
                ? `No accounts match "${search.trim()}".`
                : "No accounts match this filter."
            }
            style={themed($empty)}
          />
        ) : null}
        {accountState.error ? (
          <Text
            text={`${accountState.error.message} Tap to retry.`}
            onPress={() => (isConfigured ? void refresh() : openFireflySettings())}
            style={themed($negative)}
          />
        ) : null}
      </Screen>

      <SettingsEditorModal
        visible={editorVisible}
        title={editing ? "Edit Account" : "New Account"}
        saving={settingsMutation.status === "loading"}
        canSave={!!name.trim() && !!type.trim() && !!currency.trim()}
        onClose={() => setEditorVisible(false)}
        onSave={() => void save()}
      >
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField
          label="Firefly account type"
          value={type}
          onChangeText={setType}
          autoCapitalize="none"
          helper="Examples: asset, expense, revenue, liability"
        />
        <TextField
          label="Currency code"
          value={currency}
          onChangeText={setCurrency}
          autoCapitalize="characters"
          maxLength={3}
        />
        {settingsMutation.error ? (
          <Text text={settingsMutation.error.message} style={themed($negative)} />
        ) : null}
      </SettingsEditorModal>
    </>
  )
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
const $netWorthCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  backgroundColor: "rgba(18, 118, 77, 0.1)",
  borderColor: "rgba(62, 165, 118, 0.32)",
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 104,
  padding: spacing.sm,
})
const $netWorthCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.medium,
  fontSize: 11,
  letterSpacing: 2,
  lineHeight: 16,
})
const $heroAmount: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 28,
  lineHeight: 34,
})
const $accountCount: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.xxxs,
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
const $filters: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
  paddingRight: spacing.md,
})
const $group: ThemedStyle<ViewStyle> = () => ({ padding: 0 })
const $groupHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.xs,
  minHeight: 52,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})
const $groupTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  flex: 1,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
})
const $accountRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  flexDirection: "row",
  gap: spacing.xs,
  minHeight: 58,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})
const $accountCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $accountName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 14,
  lineHeight: 19,
})
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 17,
})
const $balance: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 13,
})
const $negative: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.medium,
})
const $edit: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 16,
  height: 32,
  justifyContent: "center",
  width: 32,
})
const $empty: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  paddingVertical: spacing.md,
  textAlign: "center",
})
