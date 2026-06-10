import { FC } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import * as Application from "expo-application"

import { Screen } from "@/components/Screen"
import {
  SettingsCard,
  SettingsIcon,
  SettingsSummaryCard,
} from "@/components/settings/SettingsPrimitives"
import { Text } from "@/components/Text"
import { useFirefly } from "@/context/FireflyContext"
import { useMoneyAgent } from "@/context/MoneyAgentContext"
import type { SettingsStackScreenProps } from "@/navigators/navigationTypes"
import { isVisibleAccount } from "@/services/firefly/transforms"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type SettingsScreenProps = SettingsStackScreenProps<"SettingsHome">

function relativeSyncLabel(lastSyncedAt?: Date) {
  if (!lastSyncedAt) return "Not synced yet"
  const minutes = Math.max(0, Math.floor((Date.now() - lastSyncedAt.getTime()) / 60000))
  if (minutes < 1) return "Last sync just now"
  if (minutes === 1) return "Last sync 1 min ago"
  if (minutes < 60) return `Last sync ${minutes} min ago`
  return `Last sync ${lastSyncedAt.toLocaleDateString()}`
}

export const SettingsScreen: FC<SettingsScreenProps> = ({ navigation }) => {
  const { themed } = useAppTheme()
  const { accounts, categories, tags, currentUser, lastSyncedAt, transactions, isRefreshing } =
    useFirefly()
  const { hasApiKey, model } = useMoneyAgent()
  const connectionError = accounts.error ?? transactions.error
  const user = currentUser.data?.attributes
  const identity = user?.name || user?.email || "Firefly user"
  const email = user?.email && user.email !== identity ? user.email : "Connected account"
  const initials = identity
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const activeAccounts = accounts.data.filter(
    (account) => isVisibleAccount(account) && account.attributes.active !== false,
  )
  const accountTypes = new Set(activeAccounts.map((account) => account.attributes.type)).size
  const version = Application.nativeApplicationVersion ?? "dev"
  const build = Application.nativeBuildVersion

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <Text text="Settings" style={themed($title)} />

      <SettingsCard style={themed($profileCard)}>
        <View style={themed($avatar)}>
          <Text text={initials || "FF"} style={themed($avatarText)} />
        </View>
        <View style={themed($profileCopy)}>
          <Text text={identity} style={themed($profileName)} />
          <Text text={email} style={themed($muted)} />
          <Text text="● Connected to Firefly III" style={themed($positive)} />
        </View>
      </SettingsCard>

      <View style={themed($cards)}>
        <SettingsSummaryCard
          title="Firefly"
          subtitle={
            connectionError
              ? "Connection needs attention"
              : `${isRefreshing ? "Syncing" : "Connected"} · ${relativeSyncLabel(lastSyncedAt)}`
          }
          status={!connectionError}
          icon="server"
          tone="blue"
          onPress={() => navigation.navigate("SettingsFirefly")}
        />
        <SettingsSummaryCard
          title="AI Assistant"
          subtitle={hasApiKey ? `${model} active` : "Gemini not configured"}
          status={hasApiKey}
          icon="creation"
          tone="primary"
          onPress={() => navigation.navigate("SettingsAiAssistant")}
        />
        <SettingsSummaryCard
          title="Accounts"
          subtitle={`${accountTypes} account types · ${activeAccounts.length} accounts`}
          icon="bank-outline"
          tone="primary"
          onPress={() => navigation.navigate("SettingsAccounts")}
        />
        <SettingsSummaryCard
          title="Classification"
          subtitle={`${categories.data.length} categories · ${tags.data.length} tags`}
          icon="view-grid-outline"
          tone="neutral"
          onPress={() => navigation.navigate("SettingsClassification")}
        />
        <SettingsSummaryCard
          title="Security"
          subtitle="Biometric unlock temporarily unavailable"
          icon="fingerprint"
          tone="blue"
          onPress={() => navigation.navigate("SettingsSecurity")}
        />
      </View>

      <Text text="DANGER ZONE" style={themed($eyebrow)} />
      <SettingsCard disabled style={themed($dangerCard)}>
        <View style={themed($dangerRow)}>
          <View style={themed($dangerIcon)}>
            <SettingsIcon name="logout" tone="danger" size={20} />
          </View>
          <Text text="Sign Out" style={themed($dangerText)} />
        </View>
        <View style={themed($dangerDivider)} />
        <View style={themed($dangerRow)}>
          <View style={themed($dangerIcon)}>
            <SettingsIcon name="trash-can-outline" tone="danger" size={20} />
          </View>
          <Text text="Clear Local Data" style={themed($dangerText)} />
        </View>
      </SettingsCard>

      <Text text={`Moneyfly · v${version}${build ? ` (${build})` : ""}`} style={themed($version)} />
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: 112,
})
const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 32,
  lineHeight: 38,
})
const $profileCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  backgroundColor: "rgba(18, 118, 77, 0.12)",
  borderColor: "rgba(62, 165, 118, 0.36)",
  flexDirection: "row",
  gap: spacing.md,
  minHeight: 86,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})
const $avatar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.primary200,
  borderRadius: 24,
  height: 48,
  justifyContent: "center",
  width: 48,
})
const $avatarText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.bold,
  fontSize: 17,
})
const $profileCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $profileName: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 17,
  lineHeight: 22,
})
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
  lineHeight: 18,
})
const $positive: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 13,
  lineHeight: 18,
})
const $cards: ThemedStyle<ViewStyle> = ({ spacing }) => ({ gap: spacing.xs })
const $eyebrow: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.textDim,
  fontFamily: typography.primary.semiBold,
  fontSize: 12,
  letterSpacing: 2.4,
  marginTop: 8,
})
const $dangerCard: ThemedStyle<ViewStyle> = () => ({
  padding: 0,
})
const $dangerRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
  minHeight: 60,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})
const $dangerIcon: ThemedStyle<ViewStyle> = () => ({
  transform: [{ scale: 0.82 }],
})
const $dangerDivider: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.stroke,
  height: 1,
})
const $dangerText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.medium,
  fontSize: 16,
})
const $version: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  textAlign: "center",
})
