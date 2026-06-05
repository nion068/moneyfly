import { FC } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"

import { FinanceCard, SectionHeader } from "@/components/firefly/FinancePrimitives"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useFirefly } from "@/context/FireflyContext"
import type { MainTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type SettingsScreenProps = MainTabScreenProps<"Settings">

export const SettingsScreen: FC<SettingsScreenProps> = () => {
  const { themed } = useAppTheme()
  const {
    baseUrl,
    disconnect,
    hideAmounts,
    toggleHideAmounts,
    refresh,
    isRefreshing,
    lastSyncedAt,
    accounts,
    transactions,
  } = useFirefly()
  const error = transactions.error ?? accounts.error

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View>
        <Text text="Settings" style={themed($title)} />
        <Text text="Connection, privacy, and automation controls" style={themed($muted)} />
      </View>

      <FinanceCard>
        <SectionHeader title="Firefly Connection" />
        <SettingRow label="Server" value={baseUrl.replace(/^https?:\/\//, "")} />
        <SettingRow
          label="Status"
          value={error ? "Needs attention" : isRefreshing ? "Refreshing" : "Connected"}
          tone={error ? undefined : "positive"}
        />
        <SettingRow
          label="Last sync"
          value={lastSyncedAt ? lastSyncedAt.toLocaleString() : "Not synced yet"}
        />
        {!!error && (
          <Text
            text={
              error.kind === "unauthorized"
                ? `${error.message} Reconnect with a valid personal access token.`
                : `${error.message} Check the server and retry.`
            }
            style={themed($error)}
          />
        )}
        <Pressable
          disabled={isRefreshing}
          onPress={() => void refresh()}
          style={themed($refreshButton)}
        >
          <Text
            text={isRefreshing ? "Refreshing..." : "Refresh now"}
            style={themed($refreshText)}
          />
        </Pressable>
        <Pressable onPress={disconnect} style={themed($dangerButton)}>
          <Text text="Disconnect" style={themed($dangerText)} />
        </Pressable>
      </FinanceCard>

      <FinanceCard>
        <SectionHeader title="Privacy" />
        <Pressable onPress={toggleHideAmounts} style={themed($settingRow)}>
          <View>
            <Text text="Hide amounts" style={themed($settingLabel)} />
            <Text text="Masks balances and transaction values in public." style={themed($muted)} />
          </View>
          <Text
            text={hideAmounts ? "On" : "Off"}
            style={themed(hideAmounts ? $positive : $settingValue)}
          />
        </Pressable>
      </FinanceCard>

      <FinanceCard>
        <SectionHeader title="AI Assistant" />
        <SettingRow label="Gemini" value="Coming later" />
      </FinanceCard>

      <FinanceCard>
        <SectionHeader title="SMS Automation" />
        <Text
          text="Deferred for the native Android milestone. The React Native client keeps this placeholder disabled until permissions, manifest receiver, and draft repository are implemented."
          style={themed($muted)}
        />
      </FinanceCard>
    </Screen>
  )
}

function SettingRow({ label, value, tone }: { label: string; value: string; tone?: "positive" }) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($settingRow)}>
      <Text text={label} style={themed($settingLabel)} />
      <Text text={value} style={themed(tone === "positive" ? $positive : $settingValue)} />
    </View>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.lg,
  padding: spacing.lg,
  paddingBottom: spacing.xxxl,
})

const $title: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.bold,
  fontSize: 40,
  lineHeight: 48,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 14,
  lineHeight: 21,
})

const $settingRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderBottomColor: colors.palette.stroke,
  borderBottomWidth: 1,
  flexDirection: "row",
  justifyContent: "space-between",
  paddingVertical: spacing.md,
})

const $settingLabel: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.medium,
  fontSize: 16,
})

const $settingValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flexShrink: 1,
  textAlign: "right",
})

const $positive: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.medium,
})

const $dangerButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderColor: colors.palette.tertiary300,
  borderRadius: 18,
  borderWidth: 1,
  marginTop: spacing.md,
  padding: spacing.md,
})

const $dangerText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.semiBold,
})

const $refreshButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderColor: colors.tint,
  borderRadius: 18,
  borderWidth: 1,
  marginTop: spacing.md,
  padding: spacing.md,
})

const $refreshText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.tint,
  fontFamily: typography.primary.semiBold,
})

const $error: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.error,
  marginTop: spacing.md,
})
