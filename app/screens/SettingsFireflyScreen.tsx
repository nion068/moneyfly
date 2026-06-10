import { FC, useState } from "react"
import { ActivityIndicator, Alert, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Screen } from "@/components/Screen"
import {
  SettingsCard,
  SettingsHeader,
  SettingsIcon,
  SettingsRow,
  SettingsSection,
  StatusText,
} from "@/components/settings/SettingsPrimitives"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useFirefly } from "@/context/FireflyContext"
import type { SettingsStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type Props = SettingsStackScreenProps<"SettingsFirefly">

export const SettingsFireflyScreen: FC<Props> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()
  const {
    baseUrl,
    accounts,
    transactions,
    lastSyncedAt,
    isRefreshing,
    isTestingConnection,
    connectionError,
    setConnection,
    refresh,
    disconnect,
  } = useFirefly()
  const [serverInput, setServerInput] = useState(baseUrl)
  const [tokenInput, setTokenInput] = useState("")
  const [editing, setEditing] = useState(false)
  const error = connectionError ?? accounts.error?.message ?? transactions.error?.message
  const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")

  async function saveConnection() {
    if (!serverInput.trim() || !tokenInput.trim()) return
    const ok = await setConnection(serverInput, tokenInput)
    if (ok) {
      setTokenInput("")
      setEditing(false)
    }
  }

  function confirmDisconnect() {
    Alert.alert(
      "Disconnect Firefly?",
      "Local connection details and synced finance data will be removed from this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: disconnect },
      ],
    )
  }

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <SettingsHeader
        title="Firefly III"
        subtitle={error ? "Needs attention" : "Connected"}
        onBack={navigation.goBack}
      />

      <SettingsCard style={themed(error ? $connectionError : $connectionHero)}>
        <SettingsIcon name="server" tone="blue" />
        <View style={themed($heroCopy)}>
          <Text text={host || "Firefly server"} style={themed($heroTitle)} />
          <Text
            text={error ?? `${transactions.data.length} transactions loaded`}
            style={themed($muted)}
          />
        </View>
        <StatusText text={error ? "Offline" : "Online"} positive={!error} />
      </SettingsCard>

      <SettingsSection title="Connection">
        <SettingsRow
          first
          title="Server URL"
          value={host}
          icon="web"
          tone="blue"
          onPress={() => setEditing((value) => !value)}
        />
        <SettingsRow
          title="API Token"
          value="Stored securely"
          icon="key-outline"
          tone="primary"
          onPress={() => setEditing(true)}
        />
        <SettingsRow
          title="Connection Status"
          value={error ? "Needs attention" : "Active"}
          icon="access-point"
          tone="blue"
          onPress={() => void refresh()}
        />
        {editing ? (
          <View style={themed($editor)}>
            <TextField
              label="Server URL"
              value={serverInput}
              onChangeText={setServerInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextField
              label="New personal access token"
              value={tokenInput}
              onChangeText={setTokenInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              helper="The current token is never displayed. Enter a token to save connection changes."
            />
            {connectionError ? <Text text={connectionError} style={themed($error)} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: isTestingConnection || !serverInput.trim() || !tokenInput.trim(),
              }}
              disabled={isTestingConnection || !serverInput.trim() || !tokenInput.trim()}
              onPress={() => void saveConnection()}
              style={themed([
                $saveConnection,
                (isTestingConnection || !serverInput.trim() || !tokenInput.trim()) &&
                  $saveConnectionDisabled,
              ])}
            >
              {isTestingConnection ? (
                <ActivityIndicator color={colors.palette.surfaceDim} size="small" />
              ) : (
                <MaterialCommunityIcons name="check" color={colors.palette.surfaceDim} size={20} />
              )}
              <Text
                text={isTestingConnection ? "Testing connection..." : "Save Connection"}
                style={themed($saveConnectionText)}
              />
            </Pressable>
          </View>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Synchronization">
        <SettingsRow
          first
          title="Last Sync"
          subtitle={
            lastSyncedAt
              ? `${lastSyncedAt.toLocaleString()} · ${transactions.data.length} transactions`
              : "No successful synchronization yet"
          }
          icon="clock-outline"
        />
        <SettingsRow
          title={isRefreshing ? "Syncing..." : "Sync Now"}
          value="Pulls all changes"
          icon="sync"
          tone="primary"
          disabled={isRefreshing}
          trailing={
            isRefreshing ? <ActivityIndicator color={colors.tint} size="small" /> : undefined
          }
          onPress={() => void refresh()}
        />
      </SettingsSection>

      <Pressable onPress={confirmDisconnect} style={themed($disconnect)}>
        <SettingsIcon name="link-variant-off" tone="danger" size={22} />
        <View style={themed($disconnectCopy)}>
          <Text text="Disconnect Firefly" style={themed($disconnectText)} />
          <Text text="Remove this server from Moneyfly" style={themed($disconnectDescription)} />
        </View>
      </Pressable>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  padding: spacing.md,
  paddingBottom: 112,
})
const $connectionHero: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: "rgba(18, 118, 77, 0.24)",
  borderColor: colors.tint,
  flexDirection: "row",
  gap: spacing.sm,
})
const $connectionError: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  borderColor: colors.error,
  flexDirection: "row",
  gap: spacing.sm,
})
const $heroCopy: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $heroTitle: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.text,
  fontFamily: typography.primary.semiBold,
  fontSize: 19,
})
const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 13,
  lineHeight: 19,
})
const $editor: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  paddingTop: spacing.sm,
})
const $error: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.error })
const $saveConnection: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.tint,
  borderRadius: 18,
  flexDirection: "row",
  gap: spacing.xs,
  justifyContent: "center",
  minHeight: 48,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
})
const $saveConnectionDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.42,
})
const $saveConnectionText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.surfaceDim,
  fontFamily: typography.primary.semiBold,
  fontSize: 14,
  lineHeight: 20,
})
const $disconnect: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  backgroundColor: colors.palette.surfaceContainer,
  borderColor: colors.palette.stroke,
  borderRadius: 22,
  borderWidth: 1,
  flexDirection: "row",
  gap: spacing.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
})
const $disconnectCopy: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
const $disconnectText: ThemedStyle<TextStyle> = ({ colors, typography }) => ({
  color: colors.palette.tertiary300,
  fontFamily: typography.primary.semiBold,
  fontSize: 15,
  lineHeight: 20,
})
const $disconnectDescription: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 12,
  lineHeight: 18,
})
