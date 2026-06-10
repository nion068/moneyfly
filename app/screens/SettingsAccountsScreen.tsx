import { FC, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import { SettingsEditorModal } from "@/components/settings/SettingsEditorModal"
import {
  SettingsCard,
  SettingsHeader,
  SettingsIcon,
} from "@/components/settings/SettingsPrimitives"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import type { FireflyAccount } from "@/models/firefly"
import type { SettingsStackScreenProps } from "@/navigators/navigationTypes"
import { formatMoney } from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Props = SettingsStackScreenProps<"SettingsAccounts">
type GroupKey = "asset" | "expense" | "revenue" | "liability"

const groupConfig: Record<
  GroupKey,
  { title: string; icon: "bank-outline" | "cart-outline" | "trending-up" | "credit-card-outline" }
> = {
  asset: { title: "Asset Accounts", icon: "bank-outline" },
  expense: { title: "Expense Accounts", icon: "cart-outline" },
  revenue: { title: "Revenue Accounts", icon: "trending-up" },
  liability: { title: "Liabilities", icon: "credit-card-outline" },
}

export function groupFor(account: FireflyAccount): GroupKey | null {
  if (account.attributes.name.trim().toLowerCase() === "cash account") return null

  const type = account.attributes.type.toLowerCase()
  if (
    type.includes("initial balance") ||
    type.includes("reconciliation") ||
    type.includes("import")
  ) {
    return null
  }
  if (type.includes("expense") || type.includes("beneficiary")) return "expense"
  if (type.includes("revenue")) return "revenue"
  if (
    type.includes("liabil") ||
    type.includes("debt") ||
    type.includes("loan") ||
    type.includes("mortgage")
  ) {
    return "liability"
  }
  if (type.includes("asset") || type.includes("cash") || type.includes("default")) return "asset"
  return null
}

function writableTypeFor(account: FireflyAccount) {
  const type = account.attributes.type.toLowerCase()
  if (type.includes("cash")) return "cash"
  if (type.includes("expense") || type.includes("beneficiary")) return "expense"
  if (type.includes("revenue")) return "revenue"
  if (
    type.includes("liabil") ||
    type.includes("loan") ||
    type.includes("debt") ||
    type.includes("mortgage")
  ) {
    return "liability"
  }
  return "asset"
}

export const SettingsAccountsScreen: FC<Props> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const { accounts, selectedCurrency, settingsMutation, saveAccount } = useFirefly()
  const [editing, setEditing] = useState<FireflyAccount | null>()
  const [editorVisible, setEditorVisible] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("asset")
  const [currency, setCurrency] = useState(selectedCurrency ?? "USD")
  const [search, setSearch] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Record<GroupKey, boolean>>({
    asset: true,
    expense: true,
    revenue: true,
    liability: true,
  })

  function openEditor(account?: FireflyAccount) {
    setEditing(account ?? null)
    setName(account?.attributes.name ?? "")
    setType(account ? writableTypeFor(account) : "asset")
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

  const manageableAccounts = accounts.data.filter((account) => groupFor(account) !== null)
  const normalizedSearch = search.trim().toLowerCase()
  const visibleAccounts = normalizedSearch
    ? manageableAccounts.filter((account) =>
        [
          account.attributes.name,
          account.attributes.account_role,
          account.attributes.type,
          account.attributes.currency_code,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch)),
      )
    : manageableAccounts

  function toggleGroup(group: GroupKey) {
    setExpandedGroups((current) => ({ ...current, [group]: !current[group] }))
  }

  return (
    <>
      <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
        <SettingsHeader
          title="Accounts"
          onBack={navigation.goBack}
          action={
            <Pressable
              accessibilityLabel="Add account"
              onPress={() => openEditor()}
              style={themed($add)}
            >
              <MaterialCommunityIcons name="plus" color={colors.palette.surfaceDim} size={30} />
            </Pressable>
          }
        />

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
              <MaterialCommunityIcons name="magnify" color={colors.textDim} size={22} />
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
                    <MaterialCommunityIcons name="close" color={colors.textDim} size={20} />
                  </Pressable>
                )
              : undefined
          }
        />

        {(["asset", "expense", "revenue", "liability"] as GroupKey[]).map((group) => {
          const items = visibleAccounts.filter((account) => groupFor(account) === group)
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
                  size={20}
                />
                <Text text={config.title} style={themed($groupTitle)} />
                <Text text={String(items.length)} style={themed($muted)} />
                <MaterialCommunityIcons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  color={colors.textDim}
                  size={22}
                />
              </Pressable>
              {expanded
                ? items.map((account) => {
                    const rawBalance =
                      account.attributes.current_balance ?? account.attributes.balance
                    const balance = rawBalance ? Number(rawBalance) : undefined
                    return (
                      <View key={account.id} style={themed($accountRow)}>
                        <View style={themed($accountCopy)}>
                          <Text text={account.attributes.name} style={themed($accountName)} />
                          <Text
                            text={account.attributes.account_role ?? account.attributes.type}
                            style={themed($muted)}
                          />
                        </View>
                        {balance !== undefined && Number.isFinite(balance) ? (
                          <Text
                            text={formatMoney(balance, account.attributes.currency_symbol ?? "")}
                            style={themed(balance < 0 ? $negative : $balance)}
                          />
                        ) : null}
                        <Pressable
                          accessibilityLabel={`Edit ${account.attributes.name}`}
                          onPress={() => openEditor(account)}
                          style={themed($edit)}
                        >
                          <MaterialCommunityIcons
                            name="pencil-outline"
                            color={colors.textDim}
                            size={20}
                          />
                        </Pressable>
                      </View>
                    )
                  })
                : null}
            </SettingsCard>
          )
        })}

        {accounts.status === "loading" && manageableAccounts.length === 0 ? (
          <Text text="Loading accounts..." style={themed($muted)} />
        ) : null}
        {accounts.status !== "loading" && manageableAccounts.length === 0 ? (
          <Text text="No manageable accounts were returned by Firefly." style={themed($muted)} />
        ) : null}
        {accounts.status !== "loading" &&
        manageableAccounts.length > 0 &&
        visibleAccounts.length === 0 ? (
          <Text text={`No accounts match "${search.trim()}".`} style={themed($emptySearch)} />
        ) : null}
        {accounts.error ? <Text text={accounts.error.message} style={themed($negative)} /> : null}
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
  gap: spacing.lg,
  padding: spacing.lg,
  paddingBottom: spacing.xxxl,
})
const $add: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.tint,
  borderRadius: 28,
  height: 56,
  justifyContent: "center",
  width: 56,
})
const $searchContainer: ThemedStyle<ViewStyle> = () => ({
  width: "100%",
})
const $searchInputWrapper: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 22,
  height: 54,
})
const $searchInput: ThemedStyle<TextStyle> = ({ colors }) => ({
  alignSelf: "center",
  color: colors.text,
  fontSize: 16,
  height: 54,
  lineHeight: 22,
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
const $group: ThemedStyle<ViewStyle> = () => ({ padding: 0 })
const $groupHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
  padding: spacing.md,
})
const $groupTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  flex: 1,
  fontFamily: typography.primary.semiBold,
  fontSize: 18,
})
const $accountRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderTopColor: colors.palette.stroke,
  borderTopWidth: 1,
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 92,
  padding: spacing.md,
})
const $accountCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $accountName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 17,
})
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  lineHeight: 20,
})
const $emptySearch: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  paddingVertical: spacing.lg,
  textAlign: "center",
})
const $balance: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
})
const $negative: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.medium,
})
const $edit: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainerHigh,
  borderRadius: 22,
  height: 44,
  justifyContent: "center",
  width: 44,
})
